let socket;
const TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
let ordersCache = [];
window.ordersCache = ordersCache;

window.logWith = (level, context, message, data) => {
    const line = `[${context}] ${message}`;
    if (data !== undefined) {
        console[level](line, data);
    } else {
        console[level](line);
    }
};
const logWith = window.logWith;

function setCredentialsVisible(visible) {
    document.getElementById("credentials").style.display = visible ? "block" : "none";
}

document.getElementById("login").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const credentialHash = await hashCredentials(username, password);
    logWith("log", "login", "Attempting login");
    // Hash the password before sending (example using SHA-256)

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialHash })
    });

    if (!res.ok) {
        logWith("error", "login", "Invalid credentials");
        alert("Invalid credentials");
        return;
    }

    const { token } = await res.json();
    logWith("log", "login", "Received token");

    // Save the token in a cookie for future sessions
    document.cookie = `authToken=${encodeURIComponent(token)}; path=/; max-age=${TOKEN_MAX_AGE_SECONDS}`;
    connect(token);
});


async function hashCredentials(username, password) {
    // Combine username and password: username acts as salt
    const combined = username + password;

    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(combined)
    );

    // Convert buffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b =>
        b.toString(16).padStart(2, "0")).join("");
}


function connect(token, auto = false) {
    return new Promise((resolve, reject) => {
        const element = document.getElementById("connected");
        logWith("log", "ws", `Connecting (auto=${auto})`);
        socket = new WebSocket(`ws://fishstix.uk:8080/?token=${token}`);
        let settled = false;

        socket.onopen = () => {
            logWith("log", "ws", "Open");
            setCredentialsVisible(false);
            if (!settled) {
                settled = true;
                resolve();
            }
            element.textContent = "Connected";
        };
        socket.onmessage = (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch (err) {
                logWith("warn", "ws", "Invalid message", err);
                return;
            }

            if (data.type === "orders-full") {
                if (!data.success) {
                    logWith("error", "ws", "Full orders error", data.error);
                    return;
                }
                ordersCache = normalizeOrders(data.value);
                window.ordersCache = ordersCache;
                createCards(ordersCache);
                sendSyncConfirm();
                return;
            }

            if (data.type === "orders-delta") {
                if (!data.success) {
                    logWith("error", "ws", "Delta orders error", data.error);
                    return;
                }
                const merged = mergeOrdersDelta(ordersCache, normalizeOrders(data.value));
                if (merged !== ordersCache) {
                    ordersCache = merged;
                    window.ordersCache = ordersCache;
                    createCards(ordersCache);
                }
                return;
            }

            if (data.type === "sync-result") {
                if (data.success) return;
                if (Array.isArray(data.value)) {
                    ordersCache = normalizeOrders(data.value);
                    window.ordersCache = ordersCache;
                    createCards(ordersCache);
                } else {
                    logWith("error", "ws", "Sync failed", data.error);
                }

            }
        };

        socket.onclose= () => {
            logWith("warn", "ws", "Closed");
            logWith("log", "ws", "Reconnecting (auto=" + auto + ")");
            attemptAutoLogin();
            element.textContent = "Disconnected";
            if (auto && !settled) {
                settled = true;
                reject();
            }
            setCredentialsVisible(true);
        };
    });

}

window.setOrdersCache = (next) => {
    ordersCache = Array.isArray(next) ? next : [];
    window.ordersCache = ordersCache;
    createCards(ordersCache);
};

function normalizeOrders(value) {
    return Array.isArray(value) ? value : [];
}

function mergeOrdersDelta(current, delta) {
    if (delta.length === 0) return current;
    if (current.length === 0) return delta;

    const seen = new Set();
    for (const item of current) {
        const lineId = Number(item?.orderLineId);
        if (Number.isInteger(lineId)) seen.add(lineId);
    }

    let changed = false;
    const merged = current.slice();
    for (const item of delta) {
        const lineId = Number(item?.orderLineId);
        if (Number.isInteger(lineId)) {
            if (seen.has(lineId)) continue;
            seen.add(lineId);
        }
        merged.push(item);
        changed = true;
    }

    return changed ? merged : current;
}

function sendSyncConfirm() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
        type: "sync-confirm",
        value: ordersCache
    }));
}


function getCookie(name) {
    const cookies = document.cookie.split(';').map(c => c.trim());
    for (const cookie of cookies) {
        const [key, value] = cookie.split('=');
        if (key === name) return decodeURIComponent(value);
    }
    return null;
}

async function attemptAutoLogin() {
    const token = getCookie("authToken");
    logWith("log", "cookie", "authToken", token ? "found" : "missing");
    if (token == null) {
        setCredentialsVisible(true);
        return;
    }
    // Try to connect using the token
    try {
        await connect(token, true); // pass a flag to handle auto-login
    } catch {
        setCredentialsVisible(true);
    }
}


attemptAutoLogin();
