const WebSocket = require("ws");
const sql = require("../../global/sql");
const {getPool, resetAuthTokens, closePool, ensureDbAvailable} = require("../helpers/db");

const {server} = require("../../kitchen/backEnd/server/state");
const {registerWebSocketHandlers} = require("../../kitchen/backEnd/server/exposed");

describe("kitchen websocket", () => {
    let port = null;
    let dbReady = false;
    const testToken = "ws-test-token";

    beforeAll(async () => {
        dbReady = await ensureDbAvailable();
        if (!dbReady) return;
        await resetAuthTokens();
        const pool = await getPool();
        await pool
            .request()
            .input("token", sql.NVarChar(64), testToken)
            .input("expires_at", sql.DateTime2, new Date(Date.now() + 60 * 60 * 1000))
            .query("INSERT INTO dbo.auth_tokens (token, expires_at) VALUES (@token, @expires_at)");

        registerWebSocketHandlers();
        await new Promise(resolve => server.listen(0, resolve));
        port = server.address().port;
    });

    afterAll(async () => {
        if (dbReady) {
            await new Promise(resolve => server.close(resolve));
            await closePool();
        }
    });

    it("sends full order payload on connect", async () => {
        if (!dbReady) return;
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${testToken}`);
        const message = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Timed out waiting for ws message")), 5000);
            ws.once("message", data => {
                clearTimeout(timeout);
                resolve(JSON.parse(data.toString()));
            });
            ws.once("error", err => {
                clearTimeout(timeout);
                reject(err);
            });
            ws.once("close", (code) => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket closed early (${code})`));
            });
        });

        expect(message.type).toBe("orders-full");
        expect(typeof message.success).toBe("boolean");

        ws.close();
        await new Promise(resolve => ws.once("close", resolve));
    });

    it("rejects connections without a token", async () => {
        if (!dbReady) return;
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        const closeEvent = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Timed out waiting for ws close")), 5000);
            ws.once("close", (code, reason) => {
                clearTimeout(timeout);
                resolve({code, reason: reason?.toString()});
            });
            ws.once("error", err => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        expect(closeEvent.code).toBe(4001);
    });
});
