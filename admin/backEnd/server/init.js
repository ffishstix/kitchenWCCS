const express = require("express");
const path = require("path");
const {publicPath} = require("./constants");

const globalPath = path.resolve(__dirname, "..", "..", "..", "global");

function configureApp(app) {
    app.use(express.json());
    app.use("/public", express.static(publicPath));
    app.use("/global", express.static(globalPath));
}

module.exports = {configureApp};
