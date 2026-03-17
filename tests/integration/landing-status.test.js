const request = require("supertest");
const {closePool, ensureDbAvailable} = require("../helpers/db");

const {createLandingApp} = require("../helpers/apps");

describe("landing status", () => {
    let dbReady = false;
    const requireLandingServices = process.env.REQUIRE_LANDING_SERVICES === "true";

    beforeAll(async () => {
        dbReady = await ensureDbAvailable();
    });

    afterAll(async () => {
        if (dbReady) {
            await closePool();
        }
    });

    it("returns combined service status", async () => {
        const app = createLandingApp();
        const response = await request(app)
            .get("/api/status")
            .expect(200);

        expect(typeof response.body.display?.ok).toBe("boolean");
        expect(typeof response.body.admin?.ok).toBe("boolean");
        if (requireLandingServices) {
            expect(response.body.display.ok).toBe(true);
            expect(response.body.admin.ok).toBe(true);
        }
        if (dbReady) {
            expect(response.body.database.ok).toBe(true);
        } else {
            expect(response.body.database.ok).toBe(false);
        }
        expect(response.body.checkedAt).toBeTruthy();
    });
});
