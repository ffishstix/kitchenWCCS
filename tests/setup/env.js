const path = require("path");
const dotenv = require("dotenv");

process.env.NODE_ENV = "test";
process.env.TZ = "UTC";

dotenv.config({
    path: path.resolve(__dirname, "..", "..", ".env.test"),
    override: true
});
