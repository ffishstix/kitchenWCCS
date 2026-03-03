const express = require("express");
const http = require("http");

const app = express();
const server = http.createServer(app);

const state = {
    pool: null,
    authTableReady: null
};

module.exports = {
    app,
    server,
    state
};
