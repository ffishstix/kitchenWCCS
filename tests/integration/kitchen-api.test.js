const request = require("supertest");
const crypto = require("crypto");
const {createKitchenApp} = require("../helpers/apps");
const {resetAuthTokens, closePool} = require("../helpers/db");

describe("kitchen api", () => {
    beforeAll(async () => {
        await resetAuthTokens();
    });

    afterAll(async () => {
        await closePool();
    });

    it("logs in and returns action key", async () => {
        const app = createKitchenApp();
        const hash = crypto
            .createHash("sha256")
            .update(String(process.env.DB_USER || "") + String(process.env.DB_PASSWORD || ""))
            .digest("hex");

        const login = await request(app)
            .post("/api/login")
            .send({credentialHash: hash})
            .expect(200);

        expect(login.body.token).toBeTruthy();
        expect(login.body.actionKey).toBeTruthy();
    });

    it("rejects finish requests without auth", async () => {
        const app = createKitchenApp();
        const response = await request(app)
            .post("/api/finish-order")
            .send({orderId: 1});

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
    });

    it("rejects login with invalid hash", async () => {
        const app = createKitchenApp();
        const response = await request(app)
            .post("/api/login")
            .send({credentialHash: "bad-hash"})
            .expect(401);

        expect(response.body.success).toBe(false);
    });

    it("rejects finish requests with wrong action key", async () => {
        const app = createKitchenApp();
        const hash = crypto
            .createHash("sha256")
            .update(String(process.env.DB_USER || "") + String(process.env.DB_PASSWORD || ""))
            .digest("hex");

        const login = await request(app)
            .post("/api/login")
            .send({credentialHash: hash})
            .expect(200);

        const response = await request(app)
            .post("/api/finish-order")
            .set("x-auth-token", login.body.token)
            .set("x-action-key", "wrong-action-key")
            .send({orderId: 1})
            .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe("Invalid action key");
    });

    it("rejects finish requests when not connected", async () => {
        const app = createKitchenApp();
        const hash = crypto
            .createHash("sha256")
            .update(String(process.env.DB_USER || "") + String(process.env.DB_PASSWORD || ""))
            .digest("hex");

        const login = await request(app)
            .post("/api/login")
            .send({credentialHash: hash})
            .expect(200);

        const response = await request(app)
            .post("/api/finish-order")
            .set("x-auth-token", login.body.token)
            .set("x-action-key", login.body.actionKey)
            .send({orderId: 1})
            .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe("Not connected");
    });
});
