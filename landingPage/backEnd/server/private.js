const sql = require("mssql");
const {logWith} = require("../../../global/logger");
const {dbConfig} = require("./constants");
const {state} = require("./state");

function getPool() {
    if (!state.pool) {
        state.pool = sql.connect(dbConfig);
    }
    return state.pool;
}

function requestStatus(url, timeoutMs) {
    return new Promise((resolve) => {
        let request;
        const target = new URL(url);
        const isHttps = target.protocol === "https:";
        const client = isHttps ? require("https") : require("http");

        const context = "requestStatus";

        logWith("info", context, `Starting request to ${url} (timeout ${timeoutMs}ms)`);

        const options = {
            method: "GET",
            hostname: target.hostname,
            port: target.port || (isHttps ? 443 : 80),
            path: `${target.pathname}${target.search}`
        };

        const finish = (ok, statusCode, error) => {
            if (ok) {
                logWith(
                    "info",
                    context,
                    `Completed ${url} with status ${statusCode}`
                );
            } else {
                logWith(
                    error === "timeout" ? "warn" : "error",
                    context,
                    `Failed ${url} (${error ?? "unknown error"})`
                );
            }

            resolve({
                ok,
                statusCode: statusCode ?? null,
                error: error ?? null,
                url
            });
        };

        request = client.request(options, (res) => {
            const statusCode = res.statusCode || 0;

            logWith(
                statusCode >= 200 && statusCode < 400 ? "info" : "warn",
                context,
                `Response from ${url}: HTTP ${statusCode}`
            );

            res.resume();
            finish(statusCode >= 200 && statusCode < 400, statusCode, null);
        });

        request.on("timeout", () => {
            logWith("warn", context, `Timeout after ${timeoutMs}ms for ${url}`);
            request.destroy();
            finish(false, null, "timeout");
        });

        request.on("error", (err) => {
            logWith(
                "error",
                context,
                `Request error for ${url}: ${err?.message || "error"}`
            );
            finish(false, null, err?.message || "error");
        });

        request.setTimeout(timeoutMs);
        request.end();
    });
}

async function checkDatabase() {
    const context = "db";
    const url = "database";

    logWith("info", context, "Starting landing database health check");

    try {
        const dbPool = await getPool();
        await dbPool.request().query("select 1 as ok");

        logWith("info", context, "Landing database health check succeeded");

        return {
            ok: true,
            statusCode: 200,
            error: null,
            url
        };
    } catch (err) {
        const errorMessage = err?.message || String(err);

        logWith(
            "warn",
            context,
            `Landing database health check failed: ${errorMessage}`
        );

        return {
            ok: false,
            statusCode: null,
            error: errorMessage,
            url
        };
    }
}

module.exports = {
    getPool,
    requestStatus,
    checkDatabase
};
