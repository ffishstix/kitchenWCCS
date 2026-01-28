let socket;

document.getElementById("login").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const credentialHash = await hashCredentials(username, password);
    // Hash the password before sending (example using SHA-256)

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialHash })
    });

    if (!res.ok) {
        alert("Invalid credentials");
        return;
    }

    const { token } = await res.json();

    // Save the token in a cookie for future sessions
    document.cookie = `authToken=${encodeURIComponent(token)}; path=/; max-age=604800`; // 7 days
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
    const hashHex = hashArray.map(b =>
        b.toString(16).padStart(2, "0")).join("");

    return hashHex;
}


function connect(token) {
    return new Promise((resolve, reject) => {
        socket = new WebSocket(`ws://localhost:8080/?token=${token}`);

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "time") {
                document.getElementById("time").textContent = data.value;
                if (auto) resolve();
            }
        };
        socket.onclose= () => {
            document.getElementById("time").textContent = "Disconnected";
            if (auto) reject();
            loginForm.style.display = "block";
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
    if (!token) {
        loginForm.style.display = "block";
        return;
    }

    // Try to connect using the token
    try {
        await connect(token, true); // pass a flag to handle auto-login
    } catch {
        document.getElementById('login').style.display = "block";
    }
}


attemptAutoLogin();
