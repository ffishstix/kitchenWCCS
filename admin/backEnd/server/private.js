const sql = require("../../../global/sql");
const {logWith} = require("../../../global/logger");
const {
    ensureAuthTokensTable,
    getTokenExpiry,
    deleteToken,
    cleanupExpiredTokens
} = require("../tokenStore");
const {dbConfig, TOKEN_CLEANUP_INTERVAL_MS} = require("./constants");
const {state} = require("./state");

function logAudit(action, details) {
    const payload = details ? ` ${JSON.stringify(details)}` : "";
    logWith("log", "audit", `${action}${payload}`);
}

function getPool() {
    if (!state.pool) {
        state.pool = sql.connect(dbConfig);
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

function getAuthToken(req) {
    return req.body?.authToken
        || req.headers["x-auth-token"]
        || readCookie(req, "authToken");
}

async function validateAuthToken(token) {
    if (!token) return {ok: false, status: 401, error: "Missing auth token"};

    await ensureAuthReady();
    const dbPool = await getPool();
    const expiresAt = await getTokenExpiry(dbPool, token);
    const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : 0;
    if (!expiresAt || Number.isNaN(expiresAtMs) || Date.now() > expiresAtMs) {
        if (expiresAt) {
            await deleteToken(dbPool, token);
        }
        return {ok: false, status: 401, error: "Token expired"};
    }
    return {ok: true};
}

async function requireAuth(req, res, next) {
    try {
        const token = getAuthToken(req);
        const authCheck = await validateAuthToken(token);
        if (!authCheck.ok) {
            res.status(authCheck.status).json({success: false, error: authCheck.error});
            return;
        }
        req.authToken = token;
        next();
    } catch (err) {
        logWith("error", "auth", "Auth validation failed");
        res.status(500).json({success: false, error: "Auth validation failed"});
    }
}

function toNullableInt(value) {
    if (value == null || value === "") return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function toBit(value) {
    if (value === true || value === 1 || value === "1" || value === "true") return 1;
    if (value === false || value === 0 || value === "0" || value === "false") return 0;
    return null;
}

function parseDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function parseDateOnly(value, endOfDay = false) {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const time = endOfDay ? "T23:59:59.999" : "T00:00:00";
    const date = new Date(`${value}${time}`);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function parseIdList(value) {
    if (!value) return "";
    const raw = Array.isArray(value) ? value.join(",") : String(value);
    const ids = raw
        .split(",")
        .map(part => part.trim())
        .map(part => Number.parseInt(part, 10))
        .filter(Number.isInteger);
    return ids.join(",");
}

module.exports = {
    logAudit,
    getPool,
    ensureAuthReady,
    startTokenCleanupLoop,
    readCookie,
    getAuthToken,
    validateAuthToken,
    requireAuth,
    toNullableInt,
    toBit,
    parseDateTime,
    parseDateOnly,
    parseIdList
};
