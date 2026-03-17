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
    const module = await loadHashModule();
    return module.hash(String(username) + String(password));
}

let hashLoadPromise = null;

function loadHashModule() {
    if (window.raa255?.hash) {
        return Promise.resolve(window.raa255);
    }
    if (hashLoadPromise) {
        return hashLoadPromise;
    }

    const candidates = ["/global/encryption.js", "../../global/encryption.js"];

    hashLoadPromise = new Promise((resolve, reject) => {
        const tryLoad = (index) => {
            if (window.raa255?.hash) {
                resolve(window.raa255);
                return;
            }
            if (index >= candidates.length) {
                reject(new Error("Hash module not loaded"));
                return;
            }

            const script = document.createElement("script");
            script.src = candidates[index];
            script.async = true;
            script.onload = () => {
                if (window.raa255?.hash) resolve(window.raa255);
                else tryLoad(index + 1);
            };
            script.onerror = () => tryLoad(index + 1);
            document.head.appendChild(script);
        };

        tryLoad(0);
    });

    return hashLoadPromise;
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
