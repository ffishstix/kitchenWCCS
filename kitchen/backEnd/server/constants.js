require("dotenv").config();

const path = require("path");
const crypto = require("crypto");

const PORT = 1248;
const TOKEN_TTL_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const indexPath = path.resolve(__dirname, "..", "..", "frontEnd", "index.html");
const publicPath = path.resolve(__dirname, "..", "..", "frontEnd", "public");

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
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const serverHash = crypto
    .createHash("sha256")
    .update(String(process.env.DB_USER || "") + String(process.env.DB_PASSWORD || ""))
    .digest("hex");

module.exports = {
    PORT,
    TOKEN_TTL_MS,
    TOKEN_CLEANUP_INTERVAL_MS,
    indexPath,
    publicPath,
    dbConfig,
    serverHash
};
