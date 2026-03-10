const request = require("supertest");
const crypto = require("crypto");
const sql = require("../../global/sql");
const {createAdminApp} = require("../helpers/apps");
const {resetAuthTokens, closePool, getPool} = require("../helpers/db");

describe("admin api", () => {
    beforeAll(async () => {
        await resetAuthTokens();
    });

    afterAll(async () => {
        await closePool();
    });

    it("logs in and validates session", async () => {
        const app = createAdminApp();
        const hash = crypto
            .createHash("sha256")
            .update(String(process.env.DB_ADMIN_USER || "") + String(process.env.DB_ADMIN_PASSWORD || ""))
            .digest("hex");

        const login = await request(app)
            .post("/api/login")
            .send({credentialHash: hash})
            .expect(200);

        expect(login.body.token).toBeTruthy();
        expect(login.body.expiresAt).toBeTruthy();

        const session = await request(app)
            .get("/api/session")
            .set("x-auth-token", login.body.token)
            .expect(200);

        expect(session.body.success).toBe(true);
    });

    it("rejects invalid login hash", async () => {
        const app = createAdminApp();
        const response = await request(app)
            .post("/api/login")
            .send({credentialHash: "not-a-real-hash"})
            .expect(401);

        expect(response.body.success).toBe(false);
    });

    it("rejects session without token", async () => {
        const app = createAdminApp();
        const response = await request(app)
            .get("/api/session")
            .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe("Missing auth token");
    });

    it("rejects expired tokens and cleans them up", async () => {
        const app = createAdminApp();
        const pool = await getPool();
        const token = "expired-admin-token";
        await pool
            .request()
            .input("token", sql.NVarChar(64), token)
            .input("expires_at", sql.DateTime2, new Date(Date.now() - 60 * 1000))
            .query("INSERT INTO dbo.auth_tokens (token, expires_at) VALUES (@token, @expires_at)");

        const response = await request(app)
            .get("/api/session")
            .set("x-auth-token", token)
            .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe("Token expired");

        const check = await pool
            .request()
            .input("token", sql.NVarChar(64), token)
            .query("SELECT token FROM dbo.auth_tokens WHERE token = @token");
        expect(check.recordset.length).toBe(0);
    });
});
