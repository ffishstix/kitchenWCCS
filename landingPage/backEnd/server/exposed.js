const {
    indexPath,
    DISPLAY_URL,
    ADMIN_URL,
    STATUS_CACHE_MS,
    REQUEST_TIMEOUT_MS
} = require("./constants");
const {state} = require("./state");
const {requestStatus, checkDatabase} = require("./private");

function registerRoutes(app) {
    app.get("/", (req, res) => {
        res.sendFile(indexPath);
    });

    app.get("/api/status", async (req, res) => {
        const now = Date.now();
        if (state.statusCache && now - state.statusCacheAt < STATUS_CACHE_MS) {
            res.json(state.statusCache);
            return;
        }

        const [display, admin, database] = await Promise.all([
            requestStatus(DISPLAY_URL, REQUEST_TIMEOUT_MS),
            requestStatus(ADMIN_URL, REQUEST_TIMEOUT_MS),
            checkDatabase()
        ]);

        state.statusCache = {
            display,
            admin,
            database,
            checkedAt: new Date().toISOString()
        };
        state.statusCacheAt = now;
        res.json(state.statusCache);
    });
}

module.exports = {registerRoutes};
