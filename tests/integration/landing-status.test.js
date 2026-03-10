const request = require("supertest");
const {closePool} = require("../helpers/db");

const {createLandingApp} = require("../helpers/apps");

describe("landing status", () => {
    afterAll(async () => {
        await closePool();
    });

    it("returns combined service status", async () => {
        const app = createLandingApp();
        const response = await request(app)
            .get("/api/status")
            .expect(200);

        expect(response.body.display.ok).toBe(true);
        expect(response.body.admin.ok).toBe(true);
        expect(response.body.database.ok).toBe(true);
        expect(response.body.checkedAt).toBeTruthy();
    });
});
