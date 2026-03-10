const sql = require("../../global/sql");

let pool = null;

function buildConfig() {
    const rawServer = process.env.DB_SERVER || "localhost";
    const serverParts = rawServer.split("\\");
    const server = serverParts[0] || "localhost";
    const instanceName = serverParts.length > 1 ? serverParts.slice(1).join("\\") : null;
    const useWindowsAuth = process.env.DB_WINDOWS_AUTH === "true";
    const odbcDriver = process.env.DB_ODBC_DRIVER || "ODBC Driver 17 for SQL Server";
    const serverName = instanceName ? `${server}\\${instanceName}` : server;
    const baseOptions = {
        encrypt: false,
        trustServerCertificate: true,
        ...(instanceName ? {instanceName} : {})
    };

    if (useWindowsAuth) {
        return {
            connectionString: `Driver={${odbcDriver}};Server=${serverName};Database=${process.env.DB_NAME};Trusted_Connection=Yes;`
        };
    }

    return {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server,
        database: process.env.DB_NAME,
        port: 1433,
        options: baseOptions
    };
}

async function getPool() {
    if (!pool) {
        pool = await sql.connect(buildConfig());
    }
    return pool;
}

async function resetAuthTokens() {
    const db = await getPool();
    await db.request().query(`
IF OBJECT_ID(N'dbo.auth_tokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.auth_tokens (
        token NVARCHAR(64) NOT NULL PRIMARY KEY,
        expires_at DATETIME2 NOT NULL
    );
    CREATE INDEX IX_auth_tokens_expires_at ON dbo.auth_tokens (expires_at);
END
DELETE FROM dbo.auth_tokens;
`);
}

async function closePool() {
    if (pool) {
        await pool.close();
        pool = null;
    }
}

module.exports = {
    getPool,
    resetAuthTokens,
    closePool
};
