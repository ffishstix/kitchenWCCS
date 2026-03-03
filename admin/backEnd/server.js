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
const crypto = require("crypto");
require("dotenv").config();
const {logWith} = require("../../global/logger");
const {
    ensureAuthTokensTable,
    saveToken,
    getTokenExpiry,
    deleteToken,
    cleanupExpiredTokens
} = require("./tokenStore");

const app = express();
const server = http.createServer(app);
const PORT = 1249;
const TOKEN_TTL_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const indexPath = path.resolve(__dirname, "../frontEnd/index.html");
const publicPath = path.resolve(__dirname, "../frontEnd/public");

const dbConfig = {
    user: process.env.DB_ADMIN_USER || process.env.DB_USER,
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
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

const adminUser = process.env.DB_ADMIN_USER || "";
const adminPassword = process.env.DB_ADMIN_PASSWORD || "";
const serverHash = crypto
    .createHash("sha256")
    .update(adminUser + adminPassword)
    .digest("hex");

logWith("log", "config", "admin server config loaded");

function logAudit(action, details) {
    const payload = details ? ` ${JSON.stringify(details)}` : "";
    logWith("log", "audit", `${action}${payload}`);
}

app.use(express.json());
app.use("/public", express.static(publicPath));

let pool;
let authTableReady = null;

function getPool() {
    if (!pool) {
        pool = sql.connect(dbConfig);
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

app.get("/", (req, res) => {
    res.sendFile(indexPath);
});

app.post(["/api/login", "/login"], async (req, res) => {
    const {credentialHash} = req.body;
    if (credentialHash == null) {
        res.status(204).json({success: false});
        return;
    }

    if (credentialHash === serverHash) {
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

        try {
            await ensureAuthReady();
            const dbPool = await getPool();
            await saveToken(dbPool, token, expiresAt);
            logWith("log", "login", "Admin login success");
            res.json({token, expiresAt});
        } catch (err) {
            logWith("error", "login", "Token save failed");
            res.status(500).json({success: false, error: "Token store error"});
        }
    } else {
        logWith("warn", "login", "Admin hash mismatch");
        res.status(401).json({success: false});
    }
});

app.get("/api/session", requireAuth, (req, res) => {
    res.json({success: true});
});

app.get("/api/top-items", requireAuth, async (req, res) => {
    const limit = Math.min(Math.max(toNullableInt(req.query.limit) || 5, 1), 100);
    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("limit", sql.Int, limit)
            .query(`
                SELECT TOP (@limit) ai.itemId,
                                    ai.itemName,
                                    ai.price,
                                    COUNT(ol.Id) AS soldCount
                FROM orderLine ol
                         JOIN allItems ai ON ai.itemId = ol.itemId
                         JOIN orders o ON o.Id = ol.orderId
                         JOIN headers h ON h.Id = o.headerId
                WHERE h.finished = 1
                GROUP BY ai.itemId, ai.itemName, ai.price
                ORDER BY soldCount DESC, ai.itemName ASC;
            `);
        res.json({success: true, items: result.recordset || []});
    } catch (err) {
        logWith("error", "db", "Top items query failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.get("/api/items", requireAuth, async (req, res) => {
    const search = String(req.query.search || "").trim();
    const searchId = toNullableInt(search);
    const limit = Math.min(Math.max(toNullableInt(req.query.limit) || 50, 1), 200);

    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("search", sql.VarChar(50), search)
            .input("searchId", sql.Int, searchId)
            .input("limit", sql.Int, limit)
            .query(`
                SELECT TOP (@limit) ai.itemId,
                                    ai.itemName,
                                    ai.price,
                                    ai.chosenColour,
                                    ai.extraInfo,
                                    ai.subCatId,
                                    ai.subItemOrder,
                                    ai.leadsToCategoryId,
                                    ai.madeInKitchen
                FROM allItems ai
                WHERE (
                          @search = ''
                              OR ai.itemName LIKE '%' + @search + '%'
                              OR (@searchId IS NOT NULL AND ai.itemId = @searchId)
                          )
                ORDER BY ai.itemName ASC;
            `);
        res.json({success: true, items: result.recordset || []});
    } catch (err) {
        logWith("error", "db", "Items query failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.post("/api/items", requireAuth, async (req, res) => {
    const itemName = String(req.body.itemName || "").trim();
    if (!itemName) {
        res.status(400).json({success: false, error: "Item name is required"});
        return;
    }

    const price = toNullableInt(req.body.price);
    if (price == null) {
        res.status(400).json({success: false, error: "Invalid price"});
        return;
    }

    const madeInKitchen = req.body.madeInKitchen == null ? null : toBit(req.body.madeInKitchen);
    if (req.body.madeInKitchen != null && madeInKitchen == null) {
        res.status(400).json({success: false, error: "Invalid madeInKitchen value"});
        return;
    }

    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("itemName", sql.VarChar(50), itemName)
            .input("price", sql.Int, price)
            .input("chosenColour", sql.VarChar(50), String(req.body.chosenColour || "").trim())
            .input("extraInfo", sql.VarChar(100), String(req.body.extraInfo || "").trim())
            .input("subCatId", sql.Int, toNullableInt(req.body.subCatId))
            .input("subItemOrder", sql.Int, toNullableInt(req.body.subItemOrder))
            .input("leadsToCategoryId", sql.Int, toNullableInt(req.body.leadsToCategoryId))
            .input("madeInKitchen", sql.Bit, madeInKitchen)
            .query(`
                INSERT INTO allItems (itemName, price, chosenColour, extraInfo, subCatId, subItemOrder, leadsToCategoryId, madeInKitchen)
                OUTPUT INSERTED.itemId,
                       INSERTED.itemName,
                       INSERTED.price,
                       INSERTED.chosenColour,
                       INSERTED.extraInfo,
                       INSERTED.subCatId,
                       INSERTED.subItemOrder,
                       INSERTED.leadsToCategoryId,
                       INSERTED.madeInKitchen
                VALUES (@itemName, @price, @chosenColour, @extraInfo, @subCatId, @subItemOrder, @leadsToCategoryId, @madeInKitchen);
            `);
        const item = result.recordset?.[0];
        logAudit("item.create", {itemId: item?.itemId});
        res.json({success: true, item});
    } catch (err) {
        logWith("error", "db", "Item create failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.get("/api/items/:id", requireAuth, async (req, res) => {
    const itemId = toNullableInt(req.params.id);
    if (itemId == null) {
        res.status(400).json({success: false, error: "Invalid item id"});
        return;
    }

    try {
        const dbPool = await getPool();
        const itemResult = await dbPool
            .request()
            .input("itemId", sql.Int, itemId)
            .query(`
                SELECT ai.itemId,
                       ai.itemName,
                       ai.price,
                       ai.chosenColour,
                       ai.extraInfo,
                       ai.subCatId,
                       ai.subItemOrder,
                       ai.leadsToCategoryId,
                       ai.madeInKitchen
                FROM allItems ai
                WHERE ai.itemId = @itemId;
            `);

        const item = itemResult.recordset?.[0];
        if (!item) {
            res.status(404).json({success: false, error: "Item not found"});
            return;
        }

        const categoriesResult = await dbPool
            .request()
            .input("itemId", sql.Int, itemId)
            .query(`
                SELECT c.categoryId,
                       c.catName
                FROM foodCategory fc
                         JOIN categories c ON c.categoryId = fc.categoryId
                WHERE fc.itemId = @itemId
                ORDER BY c.catName ASC;
            `);

        const allergiesResult = await dbPool
            .request()
            .input("itemId", sql.Int, itemId)
            .query(`
                SELECT a.allergyId,
                       a.allergyName
                FROM allergyItem ai
                         JOIN allergies a ON a.allergyId = ai.allergyId
                WHERE ai.itemId = @itemId
                ORDER BY a.allergyName ASC;
            `);

        res.json({
            success: true,
            item,
            categories: categoriesResult.recordset || [],
            allergies: allergiesResult.recordset || []
        });
    } catch (err) {
        logWith("error", "db", "Item detail query failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.patch("/api/items/:id", requireAuth, async (req, res) => {
    const itemId = toNullableInt(req.params.id);
    if (itemId == null) {
        res.status(400).json({success: false, error: "Invalid item id"});
        return;
    }

    const updates = [];
    const request = (await getPool()).request();
    request.input("itemId", sql.Int, itemId);

    if ("itemName" in req.body) {
        updates.push("itemName = @itemName");
        request.input("itemName", sql.VarChar(50), String(req.body.itemName || "").trim());
    }
    if ("price" in req.body) {
        const price = toNullableInt(req.body.price);
        if (price == null) {
            res.status(400).json({success: false, error: "Invalid price"});
            return;
        }
        updates.push("price = @price");
        request.input("price", sql.Int, price);
    }
    if ("chosenColour" in req.body) {
        updates.push("chosenColour = @chosenColour");
        request.input("chosenColour", sql.VarChar(50), String(req.body.chosenColour || "").trim());
    }
    if ("extraInfo" in req.body) {
        updates.push("extraInfo = @extraInfo");
        request.input("extraInfo", sql.VarChar(100), String(req.body.extraInfo || "").trim());
    }
    if ("subCatId" in req.body) {
        const subCatId = toNullableInt(req.body.subCatId);
        updates.push("subCatId = @subCatId");
        request.input("subCatId", sql.Int, subCatId);
    }
    if ("subItemOrder" in req.body) {
        const subItemOrder = toNullableInt(req.body.subItemOrder);
        updates.push("subItemOrder = @subItemOrder");
        request.input("subItemOrder", sql.Int, subItemOrder);
    }
    if ("leadsToCategoryId" in req.body) {
        const leadsToCategoryId = toNullableInt(req.body.leadsToCategoryId);
        updates.push("leadsToCategoryId = @leadsToCategoryId");
        request.input("leadsToCategoryId", sql.Int, leadsToCategoryId);
    }
    if ("madeInKitchen" in req.body) {
        const bit = toBit(req.body.madeInKitchen);
        if (bit == null) {
            res.status(400).json({success: false, error: "Invalid madeInKitchen value"});
            return;
        }
        updates.push("madeInKitchen = @madeInKitchen");
        request.input("madeInKitchen", sql.Bit, bit);
    }

    if (updates.length === 0) {
        res.status(400).json({success: false, error: "No valid fields to update"});
        return;
    }

    try {
        await request.query(`UPDATE allItems
                             SET ${updates.join(", ")}
                             WHERE itemId = @itemId`);
        logAudit("item.update", {itemId, fields: updates.map(field => field.split(" ")[0])});
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Item update failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.post("/api/items/:id/category", requireAuth, async (req, res) => {
    const itemId = toNullableInt(req.params.id);
    if (itemId == null) {
        res.status(400).json({success: false, error: "Invalid item id"});
        return;
    }

    const categoryId = toNullableInt(req.body.categoryId);

    try {
        const dbPool = await getPool();
        if (categoryId == null) {
            await dbPool
                .request()
                .input("itemId", sql.Int, itemId)
                .query("DELETE FROM foodCategory WHERE itemId = @itemId");
            logAudit("item.categories.clear", {itemId});
            res.json({success: true, cleared: true});
            return;
        }

        const categoryCheck = await dbPool
            .request()
            .input("categoryId", sql.Int, categoryId)
            .query("SELECT categoryId FROM categories WHERE categoryId = @categoryId");

        if (!categoryCheck.recordset?.length) {
            res.status(404).json({success: false, error: "Category not found"});
            return;
        }

        const transaction = new sql.Transaction(dbPool);
        await transaction.begin();
        try {
            await new sql.Request(transaction)
                .input("itemId", sql.Int, itemId)
                .query("DELETE FROM foodCategory WHERE itemId = @itemId");
            await new sql.Request(transaction)
                .input("itemId", sql.Int, itemId)
                .input("categoryId", sql.Int, categoryId)
                .query("INSERT INTO foodCategory (itemId, categoryId) VALUES (@itemId, @categoryId)");
            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }

        res.json({success: true});
        logAudit("item.categories.move", {itemId, categoryId});
    } catch (err) {
        logWith("error", "db", "Set category failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.post("/api/items/:id/category/add", requireAuth, async (req, res) => {
    const itemId = toNullableInt(req.params.id);
    if (itemId == null) {
        res.status(400).json({success: false, error: "Invalid item id"});
        return;
    }

    const categoryId = toNullableInt(req.body.categoryId);
    if (categoryId == null) {
        res.status(400).json({success: false, error: "Invalid category id"});
        return;
    }

    try {
        const dbPool = await getPool();
        const categoryCheck = await dbPool
            .request()
            .input("categoryId", sql.Int, categoryId)
            .query("SELECT categoryId FROM categories WHERE categoryId = @categoryId");

        if (!categoryCheck.recordset?.length) {
            res.status(404).json({success: false, error: "Category not found"});
            return;
        }

        const existing = await dbPool
            .request()
            .input("itemId", sql.Int, itemId)
            .input("categoryId", sql.Int, categoryId)
            .query("SELECT 1 FROM foodCategory WHERE itemId = @itemId AND categoryId = @categoryId");

        if (existing.recordset?.length) {
            res.json({success: true, skipped: true});
            return;
        }

        await dbPool
            .request()
            .input("itemId", sql.Int, itemId)
            .input("categoryId", sql.Int, categoryId)
            .query("INSERT INTO foodCategory (itemId, categoryId) VALUES (@itemId, @categoryId)");

        logAudit("item.categories.add", {itemId, categoryId});
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Add category failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.post("/api/items/:id/category/remove", requireAuth, async (req, res) => {
    const itemId = toNullableInt(req.params.id);
    if (itemId == null) {
        res.status(400).json({success: false, error: "Invalid item id"});
        return;
    }

    const categoryId = toNullableInt(req.body.categoryId);
    if (categoryId == null) {
        res.status(400).json({success: false, error: "Invalid category id"});
        return;
    }

    try {
        const dbPool = await getPool();
        await dbPool
            .request()
            .input("itemId", sql.Int, itemId)
            .input("categoryId", sql.Int, categoryId)
            .query("DELETE FROM foodCategory WHERE itemId = @itemId AND categoryId = @categoryId");
        logAudit("item.categories.remove", {itemId, categoryId});
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Remove category failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.post("/api/items/:id/allergy/add", requireAuth, async (req, res) => {
    const itemId = toNullableInt(req.params.id);
    if (itemId == null) {
        res.status(400).json({success: false, error: "Invalid item id"});
        return;
    }

    const allergyId = toNullableInt(req.body.allergyId);
    if (allergyId == null) {
        res.status(400).json({success: false, error: "Invalid allergy id"});
        return;
    }

    try {
        const dbPool = await getPool();
        const allergyCheck = await dbPool
            .request()
            .input("allergyId", sql.Int, allergyId)
            .query("SELECT allergyId FROM allergies WHERE allergyId = @allergyId");

        if (!allergyCheck.recordset?.length) {
            res.status(404).json({success: false, error: "Allergy not found"});
            return;
        }

        const existing = await dbPool
            .request()
            .input("itemId", sql.Int, itemId)
            .input("allergyId", sql.Int, allergyId)
            .query("SELECT 1 FROM allergyItem WHERE itemId = @itemId AND allergyId = @allergyId");

        if (existing.recordset?.length) {
            res.json({success: true, skipped: true});
            return;
        }

        await dbPool
            .request()
            .input("itemId", sql.Int, itemId)
            .input("allergyId", sql.Int, allergyId)
            .query("INSERT INTO allergyItem (itemId, allergyId) VALUES (@itemId, @allergyId)");

        logAudit("item.allergies.add", {itemId, allergyId});
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Add allergy failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.post("/api/items/:id/allergy/remove", requireAuth, async (req, res) => {
    const itemId = toNullableInt(req.params.id);
    if (itemId == null) {
        res.status(400).json({success: false, error: "Invalid item id"});
        return;
    }

    const allergyId = toNullableInt(req.body.allergyId);
    if (allergyId == null) {
        res.status(400).json({success: false, error: "Invalid allergy id"});
        return;
    }

    try {
        const dbPool = await getPool();
        await dbPool
            .request()
            .input("itemId", sql.Int, itemId)
            .input("allergyId", sql.Int, allergyId)
            .query("DELETE FROM allergyItem WHERE itemId = @itemId AND allergyId = @allergyId");
        logAudit("item.allergies.remove", {itemId, allergyId});
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Remove allergy failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.delete("/api/items/:id", requireAuth, async (req, res) => {
    const itemId = toNullableInt(req.params.id);
    if (itemId == null) {
        res.status(400).json({success: false, error: "Invalid item id"});
        return;
    }

    try {
        const dbPool = await getPool();
        const itemCheck = await dbPool
            .request()
            .input("itemId", sql.Int, itemId)
            .query("SELECT itemId FROM allItems WHERE itemId = @itemId");

        if (!itemCheck.recordset?.length) {
            res.status(404).json({success: false, error: "Item not found"});
            return;
        }

        const orderCheck = await dbPool
            .request()
            .input("itemId", sql.Int, itemId)
            .query("SELECT TOP 1 1 AS hasOrders FROM orderLine WHERE itemId = @itemId");

        if (orderCheck.recordset?.length) {
            res.status(409).json({success: false, error: "Item has order history and cannot be deleted"});
            return;
        }

        await dbPool.request().input("itemId", sql.Int, itemId)
            .query("DELETE FROM foodCategory WHERE itemId = @itemId");
        await dbPool.request().input("itemId", sql.Int, itemId)
            .query("DELETE FROM allergyItem WHERE itemId = @itemId");
        await dbPool.request().input("itemId", sql.Int, itemId)
            .query("DELETE FROM allItems WHERE itemId = @itemId");

        logAudit("item.delete", {itemId});
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Item delete failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.get("/api/categories", requireAuth, async (req, res) => {
    const search = String(req.query.search || "").trim();
    const searchId = toNullableInt(search);
    const limit = Math.min(Math.max(toNullableInt(req.query.limit) || 50, 1), 200);

    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("search", sql.VarChar(50), search)
            .input("searchId", sql.Int, searchId)
            .input("limit", sql.Int, limit)
            .query(`
                SELECT TOP (@limit) categoryId,
                                    catName
                FROM categories
                WHERE (
                          @search = ''
                              OR catName LIKE '%' + @search + '%'
                              OR (@searchId IS NOT NULL AND categoryId = @searchId)
                          )
                ORDER BY catName ASC;
            `);
        res.json({success: true, categories: result.recordset || []});
    } catch (err) {
        logWith("error", "db", "Categories query failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.post("/api/categories", requireAuth, async (req, res) => {
    const catName = String(req.body.catName || "").trim();
    if (!catName) {
        res.status(400).json({success: false, error: "Category name is required"});
        return;
    }

    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("catName", sql.VarChar(50), catName)
            .input("chosenColour", sql.VarChar(50), String(req.body.chosenColour || "").trim())
            .input("extraInfo", sql.VarChar(50), String(req.body.extraInfo || "").trim())
            .input("extraCatInfo", sql.VarChar(100), String(req.body.extraCatInfo || "").trim())
            .query(`
                INSERT INTO categories (catName, chosenColour, extraInfo, extraCatInfo)
                OUTPUT INSERTED.categoryId,
                       INSERTED.catName,
                       INSERTED.chosenColour,
                       INSERTED.extraInfo,
                       INSERTED.extraCatInfo
                VALUES (@catName, @chosenColour, @extraInfo, @extraCatInfo);
            `);
        const category = result.recordset?.[0];
        logAudit("category.create", {categoryId: category?.categoryId});
        res.json({success: true, category});
    } catch (err) {
        logWith("error", "db", "Category create failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.get("/api/categories/:id", requireAuth, async (req, res) => {
    const categoryId = toNullableInt(req.params.id);
    if (categoryId == null) {
        res.status(400).json({success: false, error: "Invalid category id"});
        return;
    }

    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("categoryId", sql.Int, categoryId)
            .query(`
                SELECT categoryId,
                       catName,
                       chosenColour,
                       extraInfo,
                       extraCatInfo
                FROM categories
                WHERE categoryId = @categoryId;
            `);
        const category = result.recordset?.[0];
        if (!category) {
            res.status(404).json({success: false, error: "Category not found"});
            return;
        }
        res.json({success: true, category});
    } catch (err) {
        logWith("error", "db", "Category detail failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.get("/api/categories/:id/items", requireAuth, async (req, res) => {
    const categoryId = toNullableInt(req.params.id);
    if (categoryId == null) {
        res.status(400).json({success: false, error: "Invalid category id"});
        return;
    }

    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("categoryId", sql.Int, categoryId)
            .query(`
                SELECT ai.itemId,
                       ai.itemName
                FROM foodCategory fc
                         JOIN allItems ai ON ai.itemId = fc.itemId
                WHERE fc.categoryId = @categoryId
                ORDER BY ai.itemName ASC;
            `);
        res.json({success: true, items: result.recordset || []});
    } catch (err) {
        logWith("error", "db", "Category items failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.patch("/api/categories/:id", requireAuth, async (req, res) => {
    const categoryId = toNullableInt(req.params.id);
    if (categoryId == null) {
        res.status(400).json({success: false, error: "Invalid category id"});
        return;
    }

    const updates = [];
    const request = (await getPool()).request();
    request.input("categoryId", sql.Int, categoryId);

    if ("catName" in req.body) {
        updates.push("catName = @catName");
        request.input("catName", sql.VarChar(50), String(req.body.catName || "").trim());
    }
    if ("chosenColour" in req.body) {
        updates.push("chosenColour = @chosenColour");
        request.input("chosenColour", sql.VarChar(50), String(req.body.chosenColour || "").trim());
    }
    if ("extraInfo" in req.body) {
        updates.push("extraInfo = @extraInfo");
        request.input("extraInfo", sql.VarChar(50), String(req.body.extraInfo || "").trim());
    }
    if ("extraCatInfo" in req.body) {
        updates.push("extraCatInfo = @extraCatInfo");
        request.input("extraCatInfo", sql.VarChar(100), String(req.body.extraCatInfo || "").trim());
    }

    if (updates.length === 0) {
        res.status(400).json({success: false, error: "No valid fields to update"});
        return;
    }

    try {
        await request.query(`UPDATE categories
                             SET ${updates.join(", ")}
                             WHERE categoryId = @categoryId`);
        logAudit("category.update", {categoryId, fields: updates.map(field => field.split(" ")[0])});
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Category update failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.delete("/api/categories/:id", requireAuth, async (req, res) => {
    const categoryId = toNullableInt(req.params.id);
    if (categoryId == null) {
        res.status(400).json({success: false, error: "Invalid category id"});
        return;
    }

    try {
        const dbPool = await getPool();
        const categoryCheck = await dbPool
            .request()
            .input("categoryId", sql.Int, categoryId)
            .query("SELECT categoryId FROM categories WHERE categoryId = @categoryId");

        if (!categoryCheck.recordset?.length) {
            res.status(404).json({success: false, error: "Category not found"});
            return;
        }

        await dbPool
            .request()
            .input("categoryId", sql.Int, categoryId)
            .query("UPDATE allItems SET leadsToCategoryId = NULL WHERE leadsToCategoryId = @categoryId");

        await dbPool
            .request()
            .input("categoryId", sql.Int, categoryId)
            .query("UPDATE allItems SET subCatId = NULL WHERE subCatId = @categoryId");

        await dbPool
            .request()
            .input("categoryId", sql.Int, categoryId)
            .query("DELETE FROM foodCategory WHERE categoryId = @categoryId");

        await dbPool
            .request()
            .input("categoryId", sql.Int, categoryId)
            .query("DELETE FROM categories WHERE categoryId = @categoryId");

        logAudit("category.delete", {categoryId});
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Category delete failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.get("/api/allergies", requireAuth, async (req, res) => {
    const search = String(req.query.search || "").trim();
    const searchId = toNullableInt(search);
    const sort = String(req.query.sort || "name").toLowerCase() === "id" ? "id" : "name";
    const limit = Math.min(Math.max(toNullableInt(req.query.limit) || 50, 1), 200);

    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("search", sql.VarChar(50), search)
            .input("searchId", sql.Int, searchId)
            .input("limit", sql.Int, limit)
            .query(`
                SELECT TOP (@limit) allergyId,
                                    allergyName
                FROM allergies
                WHERE (
                          @search = ''
                              OR allergyName LIKE '%' + @search + '%'
                              OR (@searchId IS NOT NULL AND allergyId = @searchId)
                          )
                ORDER BY ${sort === "id" ? "allergyId" : "allergyName"} ASC;
            `);
        res.json({success: true, allergies: result.recordset || []});
    } catch (err) {
        logWith("error", "db", "Allergies query failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.post("/api/allergies", requireAuth, async (req, res) => {
    const allergyName = String(req.body.allergyName || "").trim();
    if (!allergyName) {
        res.status(400).json({success: false, error: "Allergy name is required"});
        return;
    }

    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("allergyName", sql.VarChar(20), allergyName)
            .query(`
                INSERT INTO allergies (allergyName)
                OUTPUT INSERTED.allergyId,
                       INSERTED.allergyName
                VALUES (@allergyName);
            `);
        const allergy = result.recordset?.[0];
        logAudit("allergy.create", {allergyId: allergy?.allergyId});
        res.json({success: true, allergy});
    } catch (err) {
        logWith("error", "db", "Allergy create failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.get("/api/allergies/:id", requireAuth, async (req, res) => {
    const allergyId = toNullableInt(req.params.id);
    if (allergyId == null) {
        res.status(400).json({success: false, error: "Invalid allergy id"});
        return;
    }

    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("allergyId", sql.Int, allergyId)
            .query(`
                SELECT allergyId,
                       allergyName
                FROM allergies
                WHERE allergyId = @allergyId;
            `);
        const allergy = result.recordset?.[0];
        if (!allergy) {
            res.status(404).json({success: false, error: "Allergy not found"});
            return;
        }
        res.json({success: true, allergy});
    } catch (err) {
        logWith("error", "db", "Allergy detail failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.get("/api/allergies/:id/items", requireAuth, async (req, res) => {
    const allergyId = toNullableInt(req.params.id);
    if (allergyId == null) {
        res.status(400).json({success: false, error: "Invalid allergy id"});
        return;
    }

    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("allergyId", sql.Int, allergyId)
            .query(`
                SELECT items.itemId,
                       items.itemName
                FROM allergyItem ai
                         JOIN allItems items ON items.itemId = ai.itemId
                WHERE ai.allergyId = @allergyId
                ORDER BY items.itemName ASC;
            `);
        res.json({success: true, items: result.recordset || []});
    } catch (err) {
        logWith("error", "db", "Allergy items failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.patch("/api/allergies/:id", requireAuth, async (req, res) => {
    const allergyId = toNullableInt(req.params.id);
    if (allergyId == null) {
        res.status(400).json({success: false, error: "Invalid allergy id"});
        return;
    }

    const updates = [];
    const request = (await getPool()).request();
    request.input("allergyId", sql.Int, allergyId);

    if ("allergyName" in req.body) {
        updates.push("allergyName = @allergyName");
        request.input("allergyName", sql.VarChar(20), String(req.body.allergyName || "").trim());
    }

    if (updates.length === 0) {
        res.status(400).json({success: false, error: "No valid fields to update"});
        return;
    }

    try {
        await request.query(`UPDATE allergies
                             SET ${updates.join(", ")}
                             WHERE allergyId = @allergyId`);
        logAudit("allergy.update", {allergyId, fields: updates.map(field => field.split(" ")[0])});
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Allergy update failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.delete("/api/allergies/:id", requireAuth, async (req, res) => {
    const allergyId = toNullableInt(req.params.id);
    if (allergyId == null) {
        res.status(400).json({success: false, error: "Invalid allergy id"});
        return;
    }

    try {
        const dbPool = await getPool();
        const allergyCheck = await dbPool
            .request()
            .input("allergyId", sql.Int, allergyId)
            .query("SELECT allergyId FROM allergies WHERE allergyId = @allergyId");

        if (!allergyCheck.recordset?.length) {
            res.status(404).json({success: false, error: "Allergy not found"});
            return;
        }

        await dbPool
            .request()
            .input("allergyId", sql.Int, allergyId)
            .query("DELETE FROM allergyItem WHERE allergyId = @allergyId");

        await dbPool
            .request()
            .input("allergyId", sql.Int, allergyId)
            .query("DELETE FROM allergies WHERE allergyId = @allergyId");

        logAudit("allergy.delete", {allergyId});
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Allergy delete failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.get("/api/report", requireAuth, async (req, res) => {
    const rawStart = String(req.query.start || "");
    const rawEnd = String(req.query.end || "");
    const start = parseDateOnly(rawStart, false) || parseDateTime(rawStart);
    const end = parseDateOnly(rawEnd, true) || parseDateTime(rawEnd);
    const categoryList = parseIdList(req.query.categories);
    const itemList = parseIdList(req.query.items);

    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("start", sql.DateTime2, start)
            .input("end", sql.DateTime2, end)
            .input("categoryList", sql.VarChar(sql.MAX), categoryList)
            .input("itemList", sql.VarChar(sql.MAX), itemList)
            .query(`
                SELECT ai.itemId,
                       ai.itemName,
                       ai.price,
                       c.categoryId,
                       c.catName,
                       COUNT(ol.Id)  AS soldCount,
                       SUM(ai.price) AS grossRevenue
                FROM orderLine ol
                         JOIN orders o ON o.Id = ol.orderId
                         JOIN headers h ON h.Id = o.headerId
                         JOIN allItems ai ON ai.itemId = ol.itemId
                         LEFT JOIN foodCategory fc ON fc.itemId = ai.itemId
                         LEFT JOIN categories c ON c.categoryId = fc.categoryId
                WHERE h.finished = 1
                  AND (@start IS NULL OR h.sentDateTime >= @start)
                  AND (@end IS NULL OR h.sentDateTime <= @end)
                  AND (@itemList = '' OR ai.itemId IN (SELECT TRY_CONVERT(int, value)
                                                       FROM STRING_SPLIT(@itemList, ',')
                                                       WHERE TRY_CONVERT(int, value) IS NOT NULL))
                  AND (@categoryList = '' OR c.categoryId IN (SELECT TRY_CONVERT(int, value)
                                                              FROM STRING_SPLIT(@categoryList, ',')
                                                              WHERE TRY_CONVERT(int, value) IS NOT NULL))
                GROUP BY ai.itemId, ai.itemName, ai.price, c.categoryId, c.catName
                ORDER BY soldCount DESC, ai.itemName ASC;
            `);
        res.json({
            success: true,
            items: result.recordset || [],
            filters: {
                start: start ? start.toISOString() : null,
                end: end ? end.toISOString() : null,
                categories: categoryList,
                items: itemList
            }
        });
    } catch (err) {
        logWith("error", "db", "Report query failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.get("/api/staff", requireAuth, async (req, res) => {
    const search = String(req.query.search || "").trim();
    const searchId = toNullableInt(search);
    const limit = Math.min(Math.max(toNullableInt(req.query.limit) || 50, 1), 200);

    try {
        const dbPool = await getPool();
        const result = await dbPool
            .request()
            .input("search", sql.VarChar(50), search)
            .input("searchId", sql.Int, searchId)
            .input("limit", sql.Int, limit)
            .query(`
                SELECT TOP (@limit) id,
                                    name,
                                    accessLevel
                FROM staff
                WHERE (
                          @search = ''
                              OR name LIKE '%' + @search + '%'
                              OR (@searchId IS NOT NULL AND id = @searchId)
                          )
                ORDER BY name ASC;
            `);
        res.json({success: true, staff: result.recordset || []});
    } catch (err) {
        logWith("error", "db", "Staff query failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.post("/api/staff", requireAuth, async (req, res) => {
    const name = String(req.body.name || "").trim();
    const accessLevel = toNullableInt(req.body.accessLevel);

    if (!name || accessLevel == null) {
        res.status(400).json({success: false, error: "Name and access level are required"});
        return;
    }

    try {
        const dbPool = await getPool();
        const levelCheck = await dbPool
            .request()
            .input("accessLevel", sql.Int, accessLevel)
            .query("SELECT accessLevel FROM accessAlowances WHERE accessLevel = @accessLevel");

        if (!levelCheck.recordset?.length) {
            res.status(404).json({success: false, error: "Access level not found"});
            return;
        }

        const result = await dbPool
            .request()
            .input("name", sql.VarChar(50), name)
            .input("accessLevel", sql.Int, accessLevel)
            .query(`
                INSERT INTO staff (name, accessLevel)
                OUTPUT INSERTED.id,
                       INSERTED.name,
                       INSERTED.accessLevel
                VALUES (@name, @accessLevel);
            `);
        const staff = result.recordset?.[0];
        logAudit("staff.create", {staffId: staff?.id});
        res.json({success: true, staff});
    } catch (err) {
        logWith("error", "db", "Staff create failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.get("/api/access-levels", requireAuth, async (req, res) => {
    try {
        const dbPool = await getPool();
        const result = await dbPool.request().query(`
            SELECT accessLevel,
                   canSendThroughItems,
                   canDelete,
                   canNoSale,
                   canViewTables
            FROM accessAlowances
            ORDER BY accessLevel ASC;
        `);
        res.json({success: true, accessLevels: result.recordset || []});
    } catch (err) {
        logWith("error", "db", "Access levels query failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.delete("/api/staff/:id", requireAuth, async (req, res) => {
    const staffId = toNullableInt(req.params.id);
    if (staffId == null) {
        res.status(400).json({success: false, error: "Invalid staff id"});
        return;
    }

    try {
        const dbPool = await getPool();
        const staffCheck = await dbPool
            .request()
            .input("staffId", sql.Int, staffId)
            .query("SELECT id FROM staff WHERE id = @staffId");

        if (!staffCheck.recordset?.length) {
            res.status(404).json({success: false, error: "Staff not found"});
            return;
        }

        const headerCheck = await dbPool
            .request()
            .input("staffId", sql.Int, staffId)
            .query("SELECT TOP 1 1 AS hasHeaders FROM headers WHERE staffId = @staffId");

        if (headerCheck.recordset?.length) {
            res.status(409).json({success: false, error: "Staff has order history and cannot be deleted"});
            return;
        }

        await dbPool
            .request()
            .input("staffId", sql.Int, staffId)
            .query("DELETE FROM staff WHERE id = @staffId");

        logAudit("staff.delete", {staffId});
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Staff delete failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

app.patch("/api/staff/:id/access", requireAuth, async (req, res) => {
    const staffId = toNullableInt(req.params.id);
    const accessLevel = toNullableInt(req.body.accessLevel);

    if (staffId == null || accessLevel == null) {
        res.status(400).json({success: false, error: "Invalid staff id or access level"});
        return;
    }

    try {
        const dbPool = await getPool();
        const levelCheck = await dbPool
            .request()
            .input("accessLevel", sql.Int, accessLevel)
            .query("SELECT accessLevel FROM accessAlowances WHERE accessLevel = @accessLevel");

        if (!levelCheck.recordset?.length) {
            res.status(404).json({success: false, error: "Access level not found"});
            return;
        }

        await dbPool
            .request()
            .input("staffId", sql.Int, staffId)
            .input("accessLevel", sql.Int, accessLevel)
            .query("UPDATE staff SET accessLevel = @accessLevel WHERE id = @staffId");

        logAudit("staff.access.update", {staffId, accessLevel});
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Staff access update failed");
        res.status(500).json({success: false, error: "Database error"});
    }
});

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
