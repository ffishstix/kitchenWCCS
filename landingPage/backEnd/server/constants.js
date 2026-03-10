const path = require("path");

const envPath = process.env.DOTENV_CONFIG_PATH
    || (process.env.NODE_ENV === "test"
        ? path.resolve(__dirname, "..", "..", "..", ".env.test")
        : path.resolve(__dirname, "..", "..", "..", ".env"));
require("dotenv").config({path: envPath});

const PORT = 1247;
const indexPath = path.resolve(__dirname, "..", "..", "frontEnd", "index.html");
const publicPath = path.resolve(__dirname, "..", "..", "frontEnd", "public");
const DISPLAY_URL = process.env.DISPLAY_URL || "https://display.fishstix.uk";
const ADMIN_URL = process.env.ADMIN_URL || "https://admin.fishstix.uk";
const STATUS_CACHE_MS = 10000;
const REQUEST_TIMEOUT_MS = 4000;

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
            max: 5,
            min: 0,
            idleTimeoutMillis: 30000
        }
    }
    : {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server,
        database: process.env.DB_NAME,
        port: 1433,
        options: baseOptions,
        pool: {
            max: 5,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };

module.exports = {
    PORT,
    indexPath,
    publicPath,
    DISPLAY_URL,
    ADMIN_URL,
    STATUS_CACHE_MS,
    REQUEST_TIMEOUT_MS,
    dbConfig
};
