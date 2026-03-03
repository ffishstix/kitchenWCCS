document.getElementById("login").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const credentialHash = await hashCredentials(username, password);
    logWith("log", "login", "Attempting login");

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

    const {token, actionKey} = await res.json();
    logWith("log", "login", "Received token");

    document.cookie = `authToken=${encodeURIComponent(token)}; path=/; max-age=${TOKEN_MAX_AGE_SECONDS}`;
    if (actionKey) {
        document.cookie = `actionKey=${encodeURIComponent(actionKey)}; path=/; max-age=${TOKEN_MAX_AGE_SECONDS}`;
    } else {
        document.cookie = "actionKey=; path=/; max-age=0";
    }
    connect(token);
});

attemptAutoLogin();

document.getElementById("toggle-completed").addEventListener("click", () => {
    const nextView = currentOrderView === ORDER_VIEW_ACTIVE ? ORDER_VIEW_COMPLETED : ORDER_VIEW_ACTIVE;
    setOrderView(nextView);
});
