const path = require("path");

const envPath = process.env.DOTENV_CONFIG_PATH
    || (process.env.NODE_ENV === "test"
        ? path.resolve(__dirname, "..", "..", "..", ".env.test")
        : path.resolve(__dirname, "..", "..", "..", ".env"));
require("dotenv").config({path: envPath});
const hash = require("../../global/encryption.js");

const PORT = 1249;
const TOKEN_TTL_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const indexPath = path.resolve(__dirname, "..", "..", "frontEnd", "index.html");
const publicPath = path.resolve(__dirname, "..", "..", "frontEnd", "public");

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

const dbConfig = useWindowsAuth
    ? {
        connectionString: `Driver={${odbcDriver}};Server=${serverName};Database=${process.env.DB_NAME};Trusted_Connection=Yes;`,
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    }
    : {
        user: process.env.DB_ADMIN_USER || process.env.DB_USER,
        password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
        server,
        database: process.env.DB_NAME,
        port: 1433,
        options: baseOptions,
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };

const adminUser = process.env.DB_ADMIN_USER || "";
const adminPassword = process.env.DB_ADMIN_PASSWORD || "";
const serverHash = hash(String(adminUser) + String(adminPassword));

module.exports = {
    PORT,
    TOKEN_TTL_MS,
    TOKEN_CLEANUP_INTERVAL_MS,
    indexPath,
    publicPath,
    dbConfig,
    serverHash
};
