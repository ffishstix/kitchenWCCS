const express = require("express");

function createAdminApp() {
    const app = express();
    const {configureApp} = require("../../admin/backEnd/server/init");
    const {registerRoutes} = require("../../admin/backEnd/server/exposed");
    configureApp(app);
    registerRoutes(app);
    return app;
}

function createKitchenApp() {
    const app = express();
    const {configureApp} = require("../../kitchen/backEnd/server/init");
    const {registerRoutes} = require("../../kitchen/backEnd/server/exposed");
    configureApp(app);
    registerRoutes(app);
    return app;
}

function createLandingApp() {
    const app = express();
    const {configureApp} = require("../../landingPage/backEnd/server/init");
    const {registerRoutes} = require("../../landingPage/backEnd/server/exposed");
    configureApp(app);
    registerRoutes(app);
    return app;
}

module.exports = {
    createAdminApp,
    createKitchenApp,
    createLandingApp
};
