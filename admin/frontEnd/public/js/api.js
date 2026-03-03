function setAuthUi(loggedIn, statusText) {
    if (loggedIn) {
        authStatus.textContent = statusText || "Signed in";
        loginPanel.style.display = "none";
        logoutBtn.style.display = "inline-flex";
    } else {
        authStatus.textContent = statusText || "Signed out";
        loginPanel.style.display = "flex";
        logoutBtn.style.display = "none";
    }
}

function getCookie(name) {
    const cookies = document.cookie.split(";").map(c => c.trim());
    for (const cookie of cookies) {
        const [key, value] = cookie.split("=");
        if (key === name) return decodeURIComponent(value || "");
    }
    return null;
}

function setAuthCookie(token) {
    document.cookie = `authToken=${encodeURIComponent(token)}; path=/; max-age=${TOKEN_MAX_AGE_SECONDS}`;
}

function clearAuthCookie() {
    document.cookie = "authToken=; path=/; max-age=0";
}

async function api(path, options = {}) {
    const headers = Object.assign({"Content-Type": "application/json"}, options.headers || {});
    if (state.token) headers["X-Auth-Token"] = state.token;

    const res = await fetch(path, {...options, headers});

    if (res.status === 401) {
        handleUnauthorized();
        throw new Error("Unauthorized");
    }

    let data = null;
    try {
        data = await res.json();
    } catch (err) {
        data = {};
    }

    if (!res.ok || data.success === false) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

function handleUnauthorized() {
    state.token = null;
    clearAuthCookie();
    setAuthUi(false);
    showToast("Session expired", "error");
}

async function hashCredentials(username, password) {
    const combined = username + password;
    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(combined)
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function attemptLogin() {
    authAttempt += 1;
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!username || !password) {
        showToast("Enter username and password", "error");
        return;
    }

    const credentialHash = await hashCredentials(username, password);

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({credentialHash})
        });

        let data = null;
        try {
            data = await res.json();
        } catch (err) {
            data = null;
        }

        if (!res.ok) {
            const message = data?.error
                || (res.status === 401 ? "Invalid credentials" : "Login failed");
            showToast(message, "error");
            return;
        }

        state.token = data.token;
        setAuthCookie(data.token);
        setAuthUi(true);
        showToast("Welcome back");
        await loadInitialData();
    } catch (err) {
        showToast("Login failed", "error");
    }
}

async function attemptAutoLogin() {
    const token = getCookie("authToken");
    if (!token) {
        setAuthUi(false);
        return;
    }

    const attemptId = ++authAttempt;
    state.token = token;
    setAuthUi(true, "Checking session...");
    try {
        await api("/api/session");
        if (authAttempt !== attemptId) return;
        setAuthUi(true);
        await loadInitialData();
    } catch (err) {
        if (authAttempt !== attemptId) return;
        if (err.message === "Unauthorized") {
            setAuthUi(false);
            return;
        }
        setAuthUi(true, "Signed in (offline)");
        showToast("Session check failed", "error");
    }
}
