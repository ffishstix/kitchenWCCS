const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

const state = {
    pool: null,
    authTableReady: null,
    unfinishOverrides: new Map(),
    actionKeysByToken: new Map(),
    connectedTokens: new Map()
};

module.exports = {
    app,
    server,
    wss,
    state
};
