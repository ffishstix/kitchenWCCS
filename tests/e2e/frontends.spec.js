const {test, expect} = require("@playwright/test");
const {startServers, stopServers} = require("./helpers/servers");

test.describe.configure({mode: "serial"});

test.beforeAll(async () => {
    await startServers();
});

test.afterAll(async () => {
    await stopServers();
});

test("landing page loads", async ({page}) => {
    await page.goto("http://127.0.0.1:1247/");
    await expect(page).toHaveTitle("Fishstix Kitchen Hub");
});

test("kitchen display loads", async ({page}) => {
    await page.goto("http://127.0.0.1:1248/");
    await expect(page).toHaveTitle("BOH Display");
    await expect(page.locator("h1")).toContainText("Kitchen V2");
});

test("admin console loads", async ({page}) => {
    await page.goto("http://127.0.0.1:1249/");
    await expect(page).toHaveTitle("Kitchen Admin");
    await expect(page.locator(".brand-title")).toHaveText("Kitchen Admin");
});
