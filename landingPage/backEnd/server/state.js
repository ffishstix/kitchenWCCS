const express = require("express");
const http = require("http");

const app = express();
const server = http.createServer(app);

const state = {
    pool: null,
    statusCache: null,
    statusCacheAt: 0
};

module.exports = {
    app,
    server,
    state
};
