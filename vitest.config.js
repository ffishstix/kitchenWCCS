const path = require("path");

module.exports = {
    test: {
        environment: "node",
        setupFiles: [path.resolve(__dirname, "tests/setup/env.js")],
        testTimeout: 20000,
        hookTimeout: 20000,
        threads: false,
        sequence: {concurrent: false},
        globals: true,
        exclude: ["**/node_modules/**", "tests/e2e/**"]
    }
};
