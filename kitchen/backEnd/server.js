process.on("uncaughtException", err => {
    console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", err => {
    console.error("Unhandled Promise Rejection:", err);
});


const express = require("express");
const http = require("http");
const sql = require("mssql");
const path = require("path");
require("dotenv").config();
const WebSocket = require("ws");
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });
const PORT = 1248;
const crypto = require('crypto');
const { logWith } = require("../../global/logger");
const {
    ensureAuthTokensTable,
    saveToken,
    getTokenExpiry,
    deleteToken,
    cleanupExpiredTokens
} = require("./tokenStore");
const TOKEN_TTL_MS = 6 * 30 * 24 * 60 * 60 * 1000;
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
logWith("log", "config", "dbUser configured");

wss.on("connection", async (ws, req) => {
    const requestUrl = new URL(req.url || "/", "http://localhost");
    const token = requestUrl.searchParams.get("token");
    logWith("log", "ws", "Connection attempt");

    try {
        await ensureAuthReady();
        const dbPool = await getPool();
        const expiresAt = token ? await getTokenExpiry(dbPool, token) : null;
        const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : 0;
        if (!expiresAt || Number.isNaN(expiresAtMs) || Date.now() > expiresAtMs) {
            if (expiresAt) {
                await deleteToken(dbPool, token);
                logWith("warn", "auth", "Token expired");
            } else {
                logWith("warn", "auth", "Token missing or unknown");
            }
            ws.close();
            return;
        }
        logWith("log", "auth", "Token accepted");
    } catch (err) {
        logWith("error", "auth", "Token validation failed");
        ws.close();
        return;
    }

    logWith("log", "ws", "Authenticated client connected");

    let currentView = "active";
    let lastOrderLineIdActive = 0;
    let lastOrderLineIdCompleted = 0;

    const sendFullActive = async () => {
        try {
            const items = await getFoodToBeMade();
            lastOrderLineIdActive = getMaxOrderLineId(items, lastOrderLineIdActive);
            ws.send(JSON.stringify({
                type: "orders-full",
                success: true,
                value: items
            }));
        } catch (err) {
            logWith("error", "db", "Active full orders failed");
            console.error(err);
            ws.send(JSON.stringify({
                type: "orders-full",
                success: false,
                error: "Database error"
            }));
        }
    };

    const sendDeltaActive = async () => {
        try {
            const items = await getFoodToBeMadeSince(lastOrderLineIdActive);
            if (items.length === 0) return;
            lastOrderLineIdActive = getMaxOrderLineId(items, lastOrderLineIdActive);
            ws.send(JSON.stringify({
                type: "orders-delta",
                success: true,
                value: items
            }));
        } catch (err) {
            logWith("error", "db", "Active delta orders failed");
            console.error(err);
            ws.send(JSON.stringify({
                type: "orders-delta",
                success: false,
                error: "Database error"
            }));
        }
    };

    const sendFullCompleted = async () => {
        try {
            const items = await getCompletedFood();
            lastOrderLineIdCompleted = getMaxOrderLineId(items, lastOrderLineIdCompleted);
            ws.send(JSON.stringify({
                type: "orders-full",
                success: true,
                value: items
            }));
        } catch (err) {
            logWith("error", "db", "Completed full orders failed");
            console.error(err);
            ws.send(JSON.stringify({
                type: "orders-full",
                success: false,
                error: "Database error"
            }));
        }
    };

    const sendDeltaCompleted = async () => {
        try {
            const items = await getCompletedFoodSince(lastOrderLineIdCompleted);
            if (items.length === 0) return;
            lastOrderLineIdCompleted = getMaxOrderLineId(items, lastOrderLineIdCompleted);
            ws.send(JSON.stringify({
                type: "orders-delta",
                success: true,
                value: items
            }));
        } catch (err) {
            logWith("error", "db", "Completed delta orders failed");
            console.error(err);
            ws.send(JSON.stringify({
                type: "orders-delta",
                success: false,
                error: "Database error"
            }));
        }
    };

    const sendFullForView = async (view) => {
        if (view === "completed") {
            await sendFullCompleted();
        } else {
            await sendFullActive();
        }
    };

    const sendDeltaForView = async () => {
        if (currentView === "completed") {
            await sendDeltaCompleted();
        } else {
            await sendDeltaActive();
        }
    };

    const handleSyncConfirm = async (view, clientItems) => {
        try {
            const serverItems = view === "completed"
                ? await getCompletedFood()
                : await getFoodToBeMade();
            const match = listsMatch(serverItems, clientItems);
            if (match) {
                ws.send(JSON.stringify({
                    type: "sync-result",
                    success: true
                }));
                return;
            }

            if (view === "completed") {
                lastOrderLineIdCompleted = getMaxOrderLineId(serverItems, lastOrderLineIdCompleted);
            } else {
                lastOrderLineIdActive = getMaxOrderLineId(serverItems, lastOrderLineIdActive);
            }
            ws.send(JSON.stringify({
                type: "sync-result",
                success: false,
                value: serverItems
            }));
        } catch (err) {
            logWith("error", "db", "Sync confirm failed");
            console.error(err);
            ws.send(JSON.stringify({
                type: "sync-result",
                success: false,
                error: "Database error"
            }));
        }
    };

    await sendFullActive();
    const interval = setInterval(sendDeltaForView, 5000);

    ws.on("close", () => clearInterval(interval));
    ws.on("message", async (data) => {
        let message;
        try {
            message = JSON.parse(data.toString());
        } catch {
            return;
        }

        if (message?.type === "sync-confirm") {
            const view = message?.view === "completed" ? "completed" : "active";
            await handleSyncConfirm(view, Array.isArray(message.value) ? message.value : []);
            return;
        }

        if (message?.type === "set-order-view") {
            currentView = message?.value === "completed" ? "completed" : "active";
            await sendFullForView(currentView);
        }
    });
});

async function getFoodToBeMade(){
    if (!pool) pool = await sql.connect(dbConfig);

    const query = 'select o.Id as orderId, oL.Id as orderLineId, ai.itemName as itemName, ol.message as message, s.name as staffName,\n' +
        '       h.tableNumber as tableNumber, h.sentDateTime as sentDateTime, h.finished as finished\n' +
        'from allItems as ai, orderLine as oL, orders as o, headers as h, staff as s\n' +
        'where o.headerId = h.Id\n' +
        '    and oL.orderId = o.Id\n' +
        '    and ai.itemId = oL.itemId\n' +
        '    and h.finished = 0\n' +
        '    and ai.madeInKitchen = 1\n' +
        '    and s.Id = h.staffId\n' +
        'order by oL.Id asc';

    const result = await pool.request().query(query);
    logWith("log", "db", "setting order to api");
    return result.recordset.map(row => ({
        orderId: row.orderId,
        orderLineId: row.orderLineId,
        itemName: row.itemName,
        message: row.message,
        staffName: row.staffName,
        tableNumber: row.tableNumber,
        sentDateTime: row.sentDateTime,
        activeAt: normalizeDateTime(row.sentDateTime),
        finished: row.finished
    }));

}

async function getFoodToBeMadeSince(lastOrderLineId){
    if (!pool) pool = await sql.connect(dbConfig);

    const query = 'select o.Id as orderId, oL.Id as orderLineId, ai.itemName as itemName, ol.message as message, s.name as staffName,\n' +
        '       h.tableNumber as tableNumber, h.sentDateTime as sentDateTime, h.finished as finished\n' +
        'from allItems as ai, orderLine as oL, orders as o, headers as h, staff as s\n' +
        'where o.headerId = h.Id\n' +
        '    and oL.orderId = o.Id\n' +
        '    and ai.itemId = oL.itemId\n' +
        '    and h.finished = 0\n' +
        '    and ai.madeInKitchen = 1\n' +
        '    and s.Id = h.staffId\n' +
        '    and oL.Id > @lastOrderLineId\n' +
        '\n' +
        'order by oL.Id asc';

    const result = await pool
        .request()
        .input("lastOrderLineId", sql.Int, Number(lastOrderLineId) || 0)
        .query(query);
    return result.recordset.map(row => ({
        orderId: row.orderId,
        orderLineId: row.orderLineId,
        itemName: row.itemName,
        message: row.message,
        staffName: row.staffName,
        tableNumber: row.tableNumber,
        sentDateTime: row.sentDateTime,
        activeAt: normalizeDateTime(row.sentDateTime),
        finished: row.finished
    }));
}

async function getCompletedFood(){
    if (!pool) pool = await sql.connect(dbConfig);

    const query = 'select o.Id as orderId, oL.Id as orderLineId, ai.itemName as itemName, ol.message as message, s.name as staffName,\n' +
        '       h.tableNumber as tableNumber, h.sentDateTime as sentDateTime, h.finished as finished\n' +
        'from allItems as ai, orderLine as oL, orders as o, headers as h, staff as s\n' +
        'where o.headerId = h.Id\n' +
        '    and oL.orderId = o.Id\n' +
        '    and ai.itemId = oL.itemId\n' +
        '    and h.finished = 1\n' +
        '    and ai.madeInKitchen = 1\n' +
        '    and s.Id = h.staffId\n' +
        '\n' +
        'order by oL.Id asc';

    const result = await pool.request().query(query);
    logWith("log", "db", "setting completed order to api");
    return result.recordset.map(row => ({
        orderId: row.orderId,
        orderLineId: row.orderLineId,
        itemName: row.itemName,
        message: row.message,
        staffName: row.staffName,
        tableNumber: row.tableNumber,
        sentDateTime: row.sentDateTime,
        activeAt: normalizeDateTime(row.sentDateTime),
        finished: row.finished
    }));
}

async function getCompletedFoodSince(lastOrderLineId){
    if (!pool) pool = await sql.connect(dbConfig);

    const query = 'select o.Id as orderId, oL.Id as orderLineId, ai.itemName as itemName, ol.message as message, s.name as staffName,\n' +
        '       h.tableNumber as tableNumber, h.sentDateTime as sentDateTime, h.finished as finished\n' +
        'from allItems as ai, orderLine as oL, orders as o, headers as h, staff as s\n' +
        'where o.headerId = h.Id\n' +
        '    and oL.orderId = o.Id\n' +
        '    and ai.itemId = oL.itemId\n' +
        '    and h.finished = 1\n' +
        '    and ai.madeInKitchen = 1\n' +
        '    and s.Id = h.staffId\n' +
        '    and oL.Id > @lastOrderLineId\n' +
        '\n' +
        'order by oL.Id asc';

    const result = await pool
        .request()
        .input("lastOrderLineId", sql.Int, Number(lastOrderLineId) || 0)
        .query(query);
    return result.recordset.map(row => ({
        orderId: row.orderId,
        orderLineId: row.orderLineId,
        itemName: row.itemName,
        message: row.message,
        staffName: row.staffName,
        tableNumber: row.tableNumber,
        sentDateTime: row.sentDateTime,
        activeAt: normalizeDateTime(row.sentDateTime),
        finished: row.finished
    }));
}

function getMaxOrderLineId(items, fallback) {
    if (!Array.isArray(items) || items.length === 0) return fallback;
    let max = fallback || 0;
    for (const item of items) {
        const value = Number(item?.orderLineId);
        if (Number.isInteger(value) && value > max) max = value;
    }
    return max;
}

function listsMatch(serverItems, clientItems) {
    if (!Array.isArray(serverItems) || !Array.isArray(clientItems)) return false;
    if (serverItems.length !== clientItems.length) return false;

    const serverKeys = serverItems.map(makeOrderKey).sort();
    const clientKeys = clientItems.map(makeOrderKey).sort();

    for (let i = 0; i < serverKeys.length; i += 1) {
        if (serverKeys[i] !== clientKeys[i]) return false;
    }
    return true;
}

function makeOrderKey(item) {
    const orderLineId = Number(item?.orderLineId);
    if (Number.isInteger(orderLineId)) {
        return `line:${orderLineId}`;
    }

    const sentDateTime = normalizeDateTime(item?.sentDateTime);
    return [
        item?.orderId ?? "",
        item?.itemName ?? "",
        item?.message ?? "",
        item?.staffName ?? "",
        item?.tableNumber ?? "",
        sentDateTime
    ].join("|");
}

function normalizeDateTime(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    return String(value);
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

async function unfinishOrder(orderId){
    const id = Number(orderId);
    if (!Number.isInteger(id)) return;
    if (!pool) pool = await sql.connect(dbConfig);
    await pool
        .request()
        .input("orderId", sql.Int, id)
        .query("update headers set finished = 0 where Id = @orderId");
    
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

async function ensureAuthReady() {
    if (!authTableReady) {
        authTableReady = (async () => {
            const dbPool = await getPool();
            await ensureAuthTokensTable(dbPool);
            logWith("log", "auth", "Token table ready");
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
            logWith("log", "auth", "Cleaned expired tokens");
        }
    } catch (err) {
            logWith("error", "auth", "Cleanup failed");
        }
    }, TOKEN_CLEANUP_INTERVAL_MS);
}

app.get("/", (req, res) => {
    logWith("log", "ws", `Host: ${req.headers.host}`);
    logWith("log", "ws", `Origin: ${req.headers.origin}`);
    res.sendFile(indexPath);
});


app.post(["/api/login", "/login"], async (req, res) => {
    const { credentialHash } = req.body;
    if (credentialHash == null) {
        res.status(204).json({ success: false });
    }
    logWith("log", "login", "Attempt");

    // Reproduce the same hash on the server


    if (credentialHash === serverHash) {
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

        try {
            await ensureAuthReady();
            const dbPool = await getPool();
            await saveToken(dbPool, token, expiresAt);
            logWith("log", "login", "Success");
            res.json({ token });
        } catch (err) {
            logWith("error", "login", "Token save failed");
            res.status(500).json({ success: false, error: "Token store error" });
        }
    } else {
        logWith("warn", "login", "Hash mismatch");
        logWith("warn", "login", "Failed");
        res.status(401).json({ success: false });
    }
});

app.post(["/api/finish-order", "/finish-order"], async (req, res) => {
    const { orderId } = req.body;

    if (orderId == null) {
        res.status(400).json({ success: false, error: "Missing orderId" });
        return;
    }

    try {
        await finishOrder(orderId);
        res.json({ success: true });
    } catch (err) {
        logWith("error", "order", "Finish order error");
        res.status(500).json({ success: false, error: "Failed to finish order" });
    }
});

app.post(["/api/unfinish-order", "/unfinish-order"], async (req, res) => {
    const { orderId } = req.body;

    if (orderId == null) {
        res.status(400).json({ success: false, error: "Missing orderId" });
        return;
    }

    try {
        await unfinishOrder(orderId);
        res.json({ success: true });
    } catch (err) {
        logWith("error", "order", "Unfinish order error");
        res.status(500).json({ success: false, error: "Failed to unfinish order" });
    }
});

server.listen(PORT, async () => {
    logWith("log", "server", "Server running");

    try {
        await getPool();
        logWith("log", "db", "MSSQL connection pool established");
        await ensureAuthReady();
        const dbPool = await getPool();
        const cleaned = await cleanupExpiredTokens(dbPool);
        if (cleaned > 0) {
            logWith("log", "auth", "Cleaned expired tokens on startup");
        }
        startTokenCleanupLoop();
    } catch (err) {
        logWith("error", "db", "Failed to connect to MSSQL on startup");
    }
});
