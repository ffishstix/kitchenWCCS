let socket;
const TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function setCredentialsVisible(visible) {
    document.getElementById("credentials").style.display = visible ? "block" : "none";
}

document.getElementById("login").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const credentialHash = await hashCredentials(username, password);
    console.log("[login] Attempting login");
    // Hash the password before sending (example using SHA-256)

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialHash })
    });

    if (!res.ok) {
        console.warn("[login] Invalid credentials");
        alert("Invalid credentials");
        return;
    }

    const { token } = await res.json();
    console.log("[login] Received token");

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
        console.log(`[ws] Connecting (auto=${auto})`);
        socket = new WebSocket(`ws://localhost:8080/?token=${token}`);
        let settled = false;

        socket.onopen = () => {
            console.log("[ws] Open");
            setCredentialsVisible(false);
            if (!settled) {
                settled = true;
                resolve();
            }
            element.textContent = "Connected";
        };
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            createCards(data.value);
        };

        socket.onclose= () => {
            console.warn("[ws] Closed");
            element.textContent = "Disconnected";
            if (auto && !settled) {
                settled = true;
                reject();
            }
            setCredentialsVisible(true);
        };
    });

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
    console.log("[cookie] authToken", token ? "found" : "missing");
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
