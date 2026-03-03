process.on("uncaughtException", err => {
    console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", err => {
    console.error("Unhandled Promise Rejection:", err);
});

const {logWith} = require("../../global/logger");
const {app, server} = require("./server/state");
const {PORT} = require("./server/constants");
const {configureApp} = require("./server/init");
const {registerRoutes} = require("./server/exposed");

configureApp(app);
registerRoutes(app);

server.listen(PORT, () => {
    logWith("log", "server", `Server listening on port ${PORT}`);
});
