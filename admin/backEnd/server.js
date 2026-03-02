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

        res.json({success: true, item, categories: categoriesResult.recordset || []});
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

        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Add category failed");
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
        res.json({success: true});
    } catch (err) {
        logWith("error", "db", "Category update failed");
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
