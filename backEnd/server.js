const express = require("express");
const sql = require("mssql");
const path = require("path");
require("dotenv").config();
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const app = express();
const PORT = 3000;
const crypto = require('crypto');
const {
    ensureAuthTokensTable,
    saveToken,
    getTokenExpiry,
    deleteToken,
    cleanupExpiredTokens
} = require("./tokenStore");
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const indexPath = path.resolve(__dirname, "../frontEnd/index.html");
const publicPath = path.resolve(__dirname, "../frontEnd/public");
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};
const serverHash = crypto
    .createHash("sha256")
    .update(process.env.DB_USER + process.env.DB_PASSWORD)
    .digest("hex");
console.log(dbConfig.user);

wss.on("connection", async (ws, req) => {
    const params = new URLSearchParams(req.url.replace("/?", ""));
    const token = params.get("token");
    console.log("[ws] Connection attempt", { hasToken: !!token });

    try {
        await ensureAuthReady();
        const dbPool = await getPool();
        const expiresAt = token ? await getTokenExpiry(dbPool, token) : null;
        const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : 0;
        if (!expiresAt || Number.isNaN(expiresAtMs) || Date.now() > expiresAtMs) {
            if (expiresAt) {
                await deleteToken(dbPool, token);
                console.warn("[auth] Token expired", { token: formatTokenForLog(token) });
            } else {
                console.warn("[auth] Token missing or unknown", { token: formatTokenForLog(token) });
            }
            ws.close();
            return;
        }
        console.log("[auth] Token accepted", {
            token: formatTokenForLog(token),
            expiresAt: new Date(expiresAt).toISOString()
        });
    } catch (err) {
        console.error("[auth] Token validation failed", err);
        ws.close();
        return;
    }

    console.log("Authenticated client connected");

    const sendFood = async () => {
        try {
            const items = await getFoodToBeMade();
            ws.send(JSON.stringify({
                type: "food",
                success: true,
                value: items
            }));
        } catch {
            ws.send(JSON.stringify({
                type: "food",
                success: false,
                error: "Database error"
            }));
        }
    };

    await sendFood();
    const interval = setInterval(sendFood, 5000);

    ws.on("close", () => clearInterval(interval));
});

async function getFoodToBeMade(){
    if (!pool) pool = await sql.connect(dbConfig);

    const query = 'select o.Id as orderId, ai.itemName as itemName, ol.message as message, s.name as staffName,\n' +
        '       h.tableNumber as tableNumber, h.sentDateTime as sentDateTime\n' +
        'from allItems as ai, orderLine as oL, orders as o, headers as h, staff as s\n' +
        'where o.headerId = h.Id\n' +
        '    and oL.orderId = o.Id\n' +
        '    and h.finished = 0\n' +
        '    and ai.madeInKitchen = 1\n' +
        '    and s.Id = h.staffId\n' +
        '\n' +
        'order by oL.Id asc';

    const result = await pool.request().query(query);
    return result.recordset.map(row => ({
        orderId: row.orderId,
        itemName: row.itemName,
        message: row.message,
        staffName: row.staffName,
        tableNumber: row.tableNumber,
        sentDateTime: row.sentDateTime
    }));

}

async function finishOrder(orderId){
    const id = Number(orderId);
    if (!Number.isInteger(id)) return;
    if (!pool) pool = await sql.connect(dbConfig);
    await pool
        .request()
        .input("orderId", sql.Int, id)
        .query("update headers set finished = 1 where Id = @orderId");
    
}

app.use(express.json());
app.use("/public", express.static(publicPath));

let pool;
let authTableReady = null;

async function getPool() {
    if (!pool) {
        pool = await sql.connect(dbConfig);
    }
    return pool;
}

function formatTokenForLog(token) {
    if (!token) return "missing";
    if (token.length <= 8) return token;
    return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

async function ensureAuthReady() {
    if (!authTableReady) {
        authTableReady = (async () => {
            const dbPool = await getPool();
            await ensureAuthTokensTable(dbPool);
            console.log("[auth] Token table ready");
        })();
    }

    try {
        await authTableReady;
    } catch (err) {
        authTableReady = null;
        throw err;
    }
}

function startTokenCleanupLoop() {
    setInterval(async () => {
        try {
            await ensureAuthReady();
            const dbPool = await getPool();
            const cleaned = await cleanupExpiredTokens(dbPool);
            if (cleaned > 0) {
                console.log(`[auth] Cleaned ${cleaned} expired tokens`);
            }
        } catch (err) {
            console.error("[auth] Cleanup failed", err);
        }
    }, TOKEN_CLEANUP_INTERVAL_MS);
}

app.get("/", (req, res) => {
    res.sendFile(indexPath);
});

app.post("/api/connect", async (req, res) => {
    try {
        const dbPool = await getPool();

        const result = await dbPool
            .request()
            .query("SELECT GETDATE() AS serverTime");

        const time = result.recordset?.[0]?.serverTime ?? null;

        res.json({
            success: !!time,
            time
        });
    } catch (err) {
        console.error("DB error:", err);
        res.status(500).json({
            success: false,
            error: "Database connection failed"
        });
    }
});



app.post("/api/login", async (req, res) => {
    const { credentialHash } = req.body;

    console.log("[login] Attempt");

    // Reproduce the same hash on the server


    if (credentialHash === serverHash) {
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

        try {
            await ensureAuthReady();
            const dbPool = await getPool();
            await saveToken(dbPool, token, expiresAt);
            console.log("[login] Success", {
                token: formatTokenForLog(token),
                expiresAt: expiresAt.toISOString()
            });
            res.json({ token });
        } catch (err) {
            console.error("[login] Token save failed", err);
            res.status(500).json({ success: false, error: "Token store error" });
        }
    } else {
        console.log(credentialHash + "  is not equal to " + serverHash);
        console.warn("[login] Failed");
        res.status(401).json({ success: false });
    }
});

app.post("/api/finish-order", async (req, res) => {
    const { orderId } = req.body;

    if (orderId == null) {
        res.status(400).json({ success: false, error: "Missing orderId" });
        return;
    }

    try {
        await finishOrder(orderId);
        res.json({ success: true });
    } catch (err) {
        console.error("Finish order error:", err);
        res.status(500).json({ success: false, error: "Failed to finish order" });
    }
});


app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    try {
        await getPool();
        console.log("MSSQL connection pool established");
        await ensureAuthReady();
        const dbPool = await getPool();
        const cleaned = await cleanupExpiredTokens(dbPool);
        if (cleaned > 0) {
            console.log(`[auth] Cleaned ${cleaned} expired tokens on startup`);
        }
        startTokenCleanupLoop();
    } catch (err) {
        console.error("Failed to connect to MSSQL on startup:", err);
    }
});
