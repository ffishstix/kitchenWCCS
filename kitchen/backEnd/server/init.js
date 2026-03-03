const express = require("express");
const {publicPath} = require("./constants");

function configureApp(app) {
    app.use(express.json());
    app.use("/public", express.static(publicPath));
}

module.exports = {configureApp};
