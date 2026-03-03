const sql = require("mssql");
const {logWith} = require("../../../global/logger");
const {
    ensureAuthTokensTable,
    getTokenExpiry,
    deleteToken,
    cleanupExpiredTokens
} = require("../tokenStore");
const {dbConfig, TOKEN_CLEANUP_INTERVAL_MS} = require("./constants");
const {state, wss} = require("./state");

function broadcastRefresh() {
    const payload = JSON.stringify({type: "refresh"});
    for (const client of wss.clients) {
        if (client.readyState === 1) {
            client.send(payload);
        }
    }
}

function recordConnectedToken(token) {
    if (!token) return;
    const next = (state.connectedTokens.get(token) || 0) + 1;
    state.connectedTokens.set(token, next);
}

function recordDisconnectedToken(token) {
    if (!token) return;
    const next = (state.connectedTokens.get(token) || 0) - 1;
    if (next > 0) state.connectedTokens.set(token, next);
    else state.connectedTokens.delete(token);
}

function setActionKeyForToken(token, actionKey, expiresAt) {
    if (!token) return;
    state.actionKeysByToken.set(token, {actionKey, expiresAt});
}

function deleteActionKeyForToken(token) {
    if (!token) return;
    state.actionKeysByToken.delete(token);
}

function readCookie(req, name) {
    const cookieHeader = req.headers?.cookie;
    if (!cookieHeader) return null;
    const parts = cookieHeader.split(";").map(part => part.trim());
    for (const part of parts) {
        if (!part) continue;
        const eqIndex = part.indexOf("=");
        if (eqIndex === -1) continue;
        const key = part.slice(0, eqIndex);
        if (key === name) return decodeURIComponent(part.slice(eqIndex + 1));
    }
    return null;
}

function getActionAuth(req) {
    const authToken = req.body?.authToken
        || req.headers["x-auth-token"]
        || readCookie(req, "authToken");
    const actionKey = req.body?.actionKey
        || req.headers["x-action-key"]
        || readCookie(req, "actionKey");
    return {authToken, actionKey};
}

function validateActionAuth(authToken, actionKey) {
    if (!authToken || !actionKey) {
        logWith("warn", "action", "Missing auth", {hasToken: Boolean(authToken), hasActionKey: Boolean(actionKey)});
        return {ok: false, status: 401, error: "Missing auth"};
    }
    const entry = state.actionKeysByToken.get(authToken);
    if (!entry) {
        logWith("warn", "action", "Action key missing for token");
        return {ok: false, status: 401, error: "Action key missing"};
    }
    if (Number.isFinite(entry.expiresAt) && Date.now() > entry.expiresAt) {
        state.actionKeysByToken.delete(authToken);
        logWith("warn", "action", "Action key expired");
        return {ok: false, status: 401, error: "Action key expired"};
    }
    if (entry.actionKey !== actionKey) {
        logWith("warn", "action", "Invalid action key");
        return {ok: false, status: 403, error: "Invalid action key"};
    }
    if (!state.connectedTokens.has(authToken)) {
        logWith("warn", "action", "Not connected");
        return {ok: false, status: 409, error: "Not connected"};
    }
    return {ok: true};
}

async function getPool() {
    if (!state.pool) {
        state.pool = await sql.connect(dbConfig);
    }
    return state.pool;
}

async function ensureAuthReady() {
    if (!state.authTableReady) {
        state.authTableReady = (async () => {
            const dbPool = await getPool();
            await ensureAuthTokensTable(dbPool);
            logWith("log", "auth", "Token table ready");
        })();
    }

    try {
        await state.authTableReady;
    } catch (err) {
        state.authTableReady = null;
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

async function validateSocketToken(token) {
    await ensureAuthReady();
    const dbPool = await getPool();
    const expiresAt = token ? await getTokenExpiry(dbPool, token) : null;
    const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : 0;
    if (!expiresAt || Number.isNaN(expiresAtMs) || Date.now() > expiresAtMs) {
        if (expiresAt) {
            await deleteToken(dbPool, token);
            deleteActionKeyForToken(token);
            logWith("warn", "auth", "Token expired");
        } else {
            logWith("warn", "auth", "Token missing or unknown");
        }
        return {ok: false};
    }
    logWith("log", "auth", "Token accepted");
    return {ok: true};
}

function normalizeDateTime(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    return String(value);
}

function resolveOrderActiveAt(orderId, sentDateTime) {
    const override = state.unfinishOverrides.get(Number(orderId));
    if (Number.isFinite(override)) return normalizeDateTime(override);
    return normalizeDateTime(sentDateTime);
}

function resolveOrderUnfinishAt(orderId) {
    const override = state.unfinishOverrides.get(Number(orderId));
    if (Number.isFinite(override)) return normalizeDateTime(override);
    return "";
}

async function getFoodToBeMade() {
    const pool = await getPool();

    const query = "select o.Id as orderId, oL.Id as orderLineId, ai.itemName as itemName, ol.message as message, s.name as staffName,\n" +
        "       h.tableNumber as tableNumber, h.sentDateTime as sentDateTime, h.finished as finished\n" +
        "from allItems as ai, orderLine as oL, orders as o, headers as h, staff as s\n" +
        "where o.headerId = h.Id\n" +
        "    and oL.orderId = o.Id\n" +
        "    and ai.itemId = oL.itemId\n" +
        "    and h.finished = 0\n" +
        "    and ai.madeInKitchen = 1\n" +
        "    and s.Id = h.staffId\n" +
        "order by oL.Id asc";

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
        activeAt: resolveOrderActiveAt(row.orderId, row.sentDateTime),
        unfinishAt: resolveOrderUnfinishAt(row.orderId),
        finished: row.finished
    }));
}

async function getFoodToBeMadeSince(lastOrderLineId) {
    const pool = await getPool();

    const query = "select o.Id as orderId, oL.Id as orderLineId, ai.itemName as itemName, ol.message as message, s.name as staffName,\n" +
        "       h.tableNumber as tableNumber, h.sentDateTime as sentDateTime, h.finished as finished\n" +
        "from allItems as ai, orderLine as oL, orders as o, headers as h, staff as s\n" +
        "where o.headerId = h.Id\n" +
        "    and oL.orderId = o.Id\n" +
        "    and ai.itemId = oL.itemId\n" +
        "    and h.finished = 0\n" +
        "    and ai.madeInKitchen = 1\n" +
        "    and s.Id = h.staffId\n" +
        "    and oL.Id > @lastOrderLineId\n" +
        "\n" +
        "order by oL.Id asc";

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
        activeAt: resolveOrderActiveAt(row.orderId, row.sentDateTime),
        unfinishAt: resolveOrderUnfinishAt(row.orderId),
        finished: row.finished
    }));
}

async function getCompletedFood() {
    const pool = await getPool();

    const query = "select o.Id as orderId, oL.Id as orderLineId, ai.itemName as itemName, ol.message as message, s.name as staffName,\n" +
        "       h.tableNumber as tableNumber, h.sentDateTime as sentDateTime, h.finished as finished\n" +
        "from allItems as ai, orderLine as oL, orders as o, headers as h, staff as s\n" +
        "where o.headerId = h.Id\n" +
        "    and oL.orderId = o.Id\n" +
        "    and ai.itemId = oL.itemId\n" +
        "    and h.finished = 1\n" +
        "    and ai.madeInKitchen = 1\n" +
        "    and s.Id = h.staffId\n" +
        "\n" +
        "order by oL.Id asc";

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
        activeAt: resolveOrderActiveAt(row.orderId, row.sentDateTime),
        unfinishAt: resolveOrderUnfinishAt(row.orderId),
        finished: row.finished
    }));
}

async function getCompletedFoodSince(lastOrderLineId) {
    const pool = await getPool();

    const query = "select o.Id as orderId, oL.Id as orderLineId, ai.itemName as itemName, ol.message as message, s.name as staffName,\n" +
        "       h.tableNumber as tableNumber, h.sentDateTime as sentDateTime, h.finished as finished\n" +
        "from allItems as ai, orderLine as oL, orders as o, headers as h, staff as s\n" +
        "where o.headerId = h.Id\n" +
        "    and oL.orderId = o.Id\n" +
        "    and ai.itemId = oL.itemId\n" +
        "    and h.finished = 1\n" +
        "    and ai.madeInKitchen = 1\n" +
        "    and s.Id = h.staffId\n" +
        "    and oL.Id > @lastOrderLineId\n" +
        "\n" +
        "order by oL.Id asc";

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
        activeAt: resolveOrderActiveAt(row.orderId, row.sentDateTime),
        unfinishAt: resolveOrderUnfinishAt(row.orderId),
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

async function finishOrder(orderId) {
    const id = Number(orderId);
    if (!Number.isInteger(id)) return;
    const pool = await getPool();
    await pool
        .request()
        .input("orderId", sql.Int, id)
        .query("update headers set finished = 1 where Id = @orderId");
    state.unfinishOverrides.delete(id);

}

async function unfinishOrder(orderId) {
    const id = Number(orderId);
    if (!Number.isInteger(id)) return;
    const pool = await getPool();
    await pool
        .request()
        .input("orderId", sql.Int, id)
        .query("update headers set finished = 0 where Id = @orderId");
    state.unfinishOverrides.set(id, Date.now());

}

module.exports = {
    broadcastRefresh,
    recordConnectedToken,
    recordDisconnectedToken,
    setActionKeyForToken,
    deleteActionKeyForToken,
    getActionAuth,
    validateActionAuth,
    readCookie,
    getPool,
    ensureAuthReady,
    startTokenCleanupLoop,
    validateSocketToken,
    normalizeDateTime,
    resolveOrderActiveAt,
    resolveOrderUnfinishAt,
    getFoodToBeMade,
    getFoodToBeMadeSince,
    getCompletedFood,
    getCompletedFoodSince,
    getMaxOrderLineId,
    listsMatch,
    makeOrderKey,
    finishOrder,
    unfinishOrder
};
