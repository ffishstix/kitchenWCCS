const {spawn} = require("child_process");
const path = require("path");
const http = require("http");

const processes = [];

function spawnServer(label, scriptPath, env) {
    const child = spawn("node", [scriptPath], {
        env,
        stdio: ["ignore", "pipe", "pipe"]
    });
    processes.push({label, child});
    return child;
}

function waitForHttp(url, timeoutMs = 20000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const attempt = () => {
            const req = http.get(url, (res) => {
                res.resume();
                resolve();
            });
            req.on("error", () => {
                if (Date.now() - start > timeoutMs) {
                    reject(new Error(`Timed out waiting for ${url}`));
                    return;
                }
                setTimeout(attempt, 500);
            });
        };
        attempt();
    });
}

async function startServers() {
    const env = {
        ...process.env,
        NODE_ENV: "test"
    };

    const root = path.resolve(__dirname, "..", "..", "..");
    spawnServer("admin", path.join(root, "admin", "backEnd", "server.js"), env);
    spawnServer("kitchen", path.join(root, "kitchen", "backEnd", "server.js"), env);
    spawnServer("landing", path.join(root, "landingPage", "backEnd", "server.js"), env);

    await Promise.all([
        waitForHttp("http://127.0.0.1:1249/"),
        waitForHttp("http://127.0.0.1:1248/"),
        waitForHttp("http://127.0.0.1:1247/")
    ]);
}

async function stopServers() {
    await Promise.all(
        processes.map(({child}) => new Promise(resolve => {
            if (!child || child.killed) {
                resolve();
                return;
            }
            child.once("exit", resolve);
            child.kill();
        }))
    );
    processes.length = 0;
}

module.exports = {
    startServers,
    stopServers
};
