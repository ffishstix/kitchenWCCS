const sql = require("mssql");

async function ensureAuthTokensTable(pool) {
    await pool.request().query(`
IF OBJECT_ID(N'dbo.auth_tokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.auth_tokens (
        token NVARCHAR(64) NOT NULL PRIMARY KEY,
        expires_at DATETIME2 NOT NULL
    );
    CREATE INDEX IX_auth_tokens_expires_at ON dbo.auth_tokens (expires_at);
END
`);
}

async function saveToken(pool, token, expiresAt) {
    await pool
        .request()
        .input("token", sql.NVarChar(64), token)
        .input("expires_at", sql.DateTime2, expiresAt)
        .query("INSERT INTO dbo.auth_tokens (token, expires_at) VALUES (@token, @expires_at)");
}

async function getTokenExpiry(pool, token) {
    const result = await pool
        .request()
        .input("token", sql.NVarChar(64), token)
        .query("SELECT expires_at FROM dbo.auth_tokens WHERE token = @token");

    return result.recordset?.[0]?.expires_at ?? null;
}

async function deleteToken(pool, token) {
    await pool
        .request()
        .input("token", sql.NVarChar(64), token)
        .query("DELETE FROM dbo.auth_tokens WHERE token = @token");
}

async function cleanupExpiredTokens(pool, now = new Date()) {
    const result = await pool
        .request()
        .input("now", sql.DateTime2, now)
        .query("DELETE FROM dbo.auth_tokens WHERE expires_at <= @now");

    return result.rowsAffected?.[0] ?? 0;
}

module.exports = {
    ensureAuthTokensTable,
    saveToken,
    getTokenExpiry,
    deleteToken,
    cleanupExpiredTokens
};
