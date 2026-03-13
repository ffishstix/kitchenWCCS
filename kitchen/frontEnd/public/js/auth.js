function clearAuthCookie() {
    document.cookie = "authToken=; path=/; max-age=0";
    document.cookie = "actionKey=; path=/; max-age=0";
}

function getCookie(name) {
    const cookies = document.cookie.split(";").map(c => c.trim());
    for (const cookie of cookies) {
        const [key, value] = cookie.split("=");
        if (key === name) return decodeURIComponent(value);
    }
    return null;
}

async function hashCredentials(username, password) {
    const hash = require("../../../../global/encryption.js");
    return hash(String(username) + String(password));
}

async function attemptAutoLogin() {
    const token = getCookie("authToken");
    logWith("log", "cookie", "authToken", token ? "found" : "missing");
    if (token == null) {
        setConnectionStatus("Disconnected");
        setCredentialsVisible(true);
        return;
    }

    try {
        await connect(token, true);
    } catch {
        setCredentialsVisible(true);
    }
}
