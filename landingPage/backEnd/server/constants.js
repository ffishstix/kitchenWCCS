require("dotenv").config();

const path = require("path");

const PORT = 1247;
const indexPath = path.resolve(__dirname, "..", "..", "frontEnd", "index.html");
const publicPath = path.resolve(__dirname, "..", "..", "frontEnd", "public");
const DISPLAY_URL = process.env.DISPLAY_URL || "https://display.fishstix.uk";
const ADMIN_URL = process.env.ADMIN_URL || "https://admin.fishstix.uk";
const STATUS_CACHE_MS = 10000;
const REQUEST_TIMEOUT_MS = 4000;

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
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
