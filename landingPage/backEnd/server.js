process.on("uncaughtException", err => {
    console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", err => {
    console.error("Unhandled Promise Rejection:", err);
});


const express = require("express");
const http = require("http");
const path = require("path");
const sql = require("mssql");
require("dotenv").config();
const app = express();
const server = http.createServer(app);
const PORT = 1247;
const { logWith } = require("../../global/logger");
const indexPath = path.resolve(__dirname, "../frontEnd/index.html");
const publicPath = path.resolve(__dirname, "../frontEnd/public");
const DISPLAY_URL = process.env.DISPLAY_URL || "https://display.fishstix.uk";
const ADMIN_URL = process.env.ADMIN_URL || "https://admin.fishstix.uk";
const STATUS_CACHE_MS = 10000;
const REQUEST_TIMEOUT_MS = 4000;
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
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool;
let statusCache = null;
let statusCacheAt = 0;

function getPool() {
    if (!pool) {
        pool = sql.connect(dbConfig);
    }
    return pool;
}

function requestStatus(url, timeoutMs) {
    return new Promise((resolve) => {
        let request;
        const target = new URL(url);
        const isHttps = target.protocol === "https:";
        const client = isHttps ? require("https") : require("http");

        const context = "requestStatus";

        logWith("info", context, `Starting request to ${url} (timeout ${timeoutMs}ms)`);

        const options = {
            method: "GET",
            hostname: target.hostname,
            port: target.port || (isHttps ? 443 : 80),
            path: `${target.pathname}${target.search}`
        };

        const finish = (ok, statusCode, error) => {
            if (ok) {
                logWith(
                    "info",
                    context,
                    `Completed ${url} with status ${statusCode}`
                );
            } else {
                logWith(
                    error === "timeout" ? "warn" : "error",
                    context,
                    `Failed ${url} (${error ?? "unknown error"})`
                );
            }

            resolve({
                ok,
                statusCode: statusCode ?? null,
                error: error ?? null,
                url
            });
        };

        request = client.request(options, (res) => {
            const statusCode = res.statusCode || 0;

            logWith(
                statusCode >= 200 && statusCode < 400 ? "info" : "warn",
                context,
                `Response from ${url}: HTTP ${statusCode}`
            );

            res.resume();
            finish(statusCode >= 200 && statusCode < 400, statusCode, null);
        });

        request.on("timeout", () => {
            logWith("warn", context, `Timeout after ${timeoutMs}ms for ${url}`);
            request.destroy();
            finish(false, null, "timeout");
        });

        request.on("error", (err) => {
            logWith(
                "error",
                context,
                `Request error for ${url}: ${err?.message || "error"}`
            );
            finish(false, null, err?.message || "error");
        });

        request.setTimeout(timeoutMs);
        request.end();
    });
}

async function checkDatabase() {
    const context = "db";
    const url = "database";

    logWith("info", context, "Starting landing database health check");

    try {
        const dbPool = await getPool();
        await dbPool.request().query("select 1 as ok");

        logWith("info", context, "Landing database health check succeeded");

        return {
            ok: true,
            statusCode: 200,
            error: null,
            url
        };
    } catch (err) {
        const errorMessage = err?.message || String(err);

        logWith(
            "warn",
            context,
            `Landing database health check failed: ${errorMessage}`
        );

        return {
            ok: false,
            statusCode: null,
            error: errorMessage,
            url
        };
    }
}



app.use("/public", express.static(publicPath));

app.get("/", (req, res) => {
    res.sendFile(indexPath);
});

app.get("/api/status", async (req, res) => {
    const now = Date.now();
    if (statusCache && now - statusCacheAt < STATUS_CACHE_MS) {
        res.json(statusCache);
        return;
    }

    const [display, admin, database] = await Promise.all([
        requestStatus(DISPLAY_URL, REQUEST_TIMEOUT_MS),
        requestStatus(ADMIN_URL, REQUEST_TIMEOUT_MS),
        checkDatabase()
    ]);

    statusCache = {
        display,
        admin,
        database,
        checkedAt: new Date().toISOString()
    };
    statusCacheAt = now;
    res.json(statusCache);
});

server.listen(PORT, () => {
    logWith("log", "server", `Server listening on port ${PORT}`);
});
