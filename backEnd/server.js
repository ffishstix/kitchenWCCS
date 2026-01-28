const express = require("express");
const sql = require("mssql");
const path = require("path");
require("dotenv").config();
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const app = express();
const PORT = 3000;
const crypto = require('crypto');
const activeTokens = new Set();
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

wss.on("connection", (ws, req) => {
    const params = new URLSearchParams(req.url.replace("/?", ""));
    const token = params.get("token");

    if (!activeTokens.has(token)) {
        ws.close();
        return;
    }

    console.log("Authenticated client connected");

    activeTokens.delete(token); // one-time use token

    const sendTime = async () => {
        try {
            const time = await getServerTime();
            ws.send(JSON.stringify({
                type: "time",
                value: time
            }));
        } catch {
            ws.send(JSON.stringify({
                type: "error",
                value: "Database error"
            }));
        }
    };

    sendTime();
    const interval = setInterval(sendTime, 5000);

    ws.on("close", () => clearInterval(interval));
});

async function getServerTime() {
    if (!pool) {
        pool = await sql.connect(dbConfig);
    }

    const result = await pool.request().query(`
    SELECT GETDATE() AS serverTime
  `);

    return result.recordset[0].serverTime;
}


app.use(express.json());
app.use("/public", express.static(publicPath));

let pool;

async function getPool() {
    if (!pool) {
        pool = await sql.connect(dbConfig);
    }
    return pool;
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

        res.json({
            success: true,
            serverTime: result.recordset[0].serverTime
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


    // Reproduce the same hash on the server


    if (credentialHash === serverHash) {
        const token = crypto.randomUUID();
        activeTokens.add(token);
        res.json({ token });
    } else {
        console.log(credentialHash + "  is not equal to " + serverHash);
        res.status(401).json({ success: false });
    }
});


app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    try {
        await getPool();
        console.log("MSSQL connection pool established");
    } catch (err) {
        console.error("Failed to connect to MSSQL on startup:", err);
    }
});
