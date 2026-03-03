process.on("uncaughtException", err => {
    console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", err => {
    console.error("Unhandled Promise Rejection:", err);
});

const {logWith} = require("../../global/logger");
const {app, server} = require("./server/state");
const {PORT} = require("./server/constants");
const {configureApp} = require("./server/init");
const {registerRoutes} = require("./server/exposed");
const {getPool, ensureAuthReady, startTokenCleanupLoop} = require("./server/private");
const {cleanupExpiredTokens} = require("./tokenStore");

logWith("log", "config", "admin server config loaded");

configureApp(app);
registerRoutes(app);

server.listen(PORT, async () => {
    logWith("log", "server", `Admin server running on port ${PORT}`);

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
