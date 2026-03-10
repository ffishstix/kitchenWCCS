const {defineConfig} = require("@playwright/test");

module.exports = defineConfig({
    testDir: "tests/e2e",
    timeout: 30000,
    use: {
        headless: true
    },
    projects: [
        {
            name: "chromium",
            use: {browserName: "chromium"}
        }
    ]
});
