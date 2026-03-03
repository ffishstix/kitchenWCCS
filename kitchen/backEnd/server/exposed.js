const crypto = require("crypto");
const {logWith} = require("../../../global/logger");
const {saveToken} = require("../tokenStore");
const {TOKEN_TTL_MS, indexPath, serverHash} = require("./constants");
const {wss} = require("./state");
const {
    broadcastRefresh,
    recordConnectedToken,
    recordDisconnectedToken,
    setActionKeyForToken,
    getActionAuth,
    validateActionAuth,
    getPool,
    ensureAuthReady,
    validateSocketToken,
    getFoodToBeMade,
    getFoodToBeMadeSince,
    getCompletedFood,
    getCompletedFoodSince,
    getMaxOrderLineId,
    listsMatch,
    finishOrder,
    unfinishOrder
} = require("./private");

function registerRoutes(app) {
    app.get("/", (req, res) => {
        res.sendFile(indexPath);
    });

    app.post(["/api/login", "/login"], async (req, res) => {
        const { credentialHash } = req.body;
        if (credentialHash == null) {
            res.status(204).json({ success: false });
            return;
        }
        logWith("log", "login", "Attempt");

        if (credentialHash === serverHash) {
            const token = crypto.randomUUID();
            const actionKey = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

            try {
                await ensureAuthReady();
                const dbPool = await getPool();
                await saveToken(dbPool, token, expiresAt);
                setActionKeyForToken(token, actionKey, expiresAt.getTime());
                logWith("log", "login", "Success");
                res.json({token, actionKey});
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
        const {authToken, actionKey} = getActionAuth(req);
        logWith("log", "action", "Finish request", {
            orderId,
            hasToken: Boolean(authToken),
            hasActionKey: Boolean(actionKey)
        });
        const authCheck = validateActionAuth(authToken, actionKey);
        if (!authCheck.ok) {
            res.status(authCheck.status).json({success: false, error: authCheck.error});
            return;
        }

        if (orderId == null) {
            res.status(400).json({ success: false, error: "Missing orderId" });
            return;
        }

        try {
            await finishOrder(orderId);
            broadcastRefresh();
            res.json({ success: true });
        } catch (err) {
            logWith("error", "order", "Finish order error");
            res.status(500).json({ success: false, error: "Failed to finish order" });
        }
    });

    app.post(["/api/unfinish-order", "/unfinish-order"], async (req, res) => {
        const { orderId } = req.body;
        const {authToken, actionKey} = getActionAuth(req);
        logWith("log", "action", "Unfinish request", {
            orderId,
            hasToken: Boolean(authToken),
            hasActionKey: Boolean(actionKey)
        });
        const authCheck = validateActionAuth(authToken, actionKey);
        if (!authCheck.ok) {
            res.status(authCheck.status).json({success: false, error: authCheck.error});
            return;
        }

        if (orderId == null) {
            res.status(400).json({ success: false, error: "Missing orderId" });
            return;
        }

        try {
            await unfinishOrder(orderId);
            broadcastRefresh();
            res.json({ success: true });
        } catch (err) {
            logWith("error", "order", "Unfinish order error");
            res.status(500).json({ success: false, error: "Failed to unfinish order" });
        }
    });
}

function registerWebSocketHandlers() {
    wss.on("connection", async (ws, req) => {
        const requestUrl = new URL(req.url || "/", "http://localhost");
        const token = requestUrl.searchParams.get("token");
        logWith("log", "ws", "Connection attempt");

        try {
            const authCheck = await validateSocketToken(token);
            if (!authCheck.ok) {
                ws.close(4001, "Unauthorized");
                return;
            }
        } catch (err) {
            logWith("error", "auth", "Token validation failed");
            ws.close(1011, "Auth validation failed");
            return;
        }

        logWith("log", "ws", "Authenticated client connected");
        ws.authToken = token;
        recordConnectedToken(token);

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

        ws.on("close", () => {
            recordDisconnectedToken(ws.authToken);
            clearInterval(interval);
        });
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
}

module.exports = {
    registerRoutes,
    registerWebSocketHandlers
};
