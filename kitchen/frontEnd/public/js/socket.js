function setConnectionStatus(status) {
    const element = document.getElementById("connected");
    if (element) element.textContent = status;
}

function resetReconnectBackoff() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    reconnectDelayMs = RECONNECT_DELAY_BASE_MS;
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    const delay = reconnectDelayMs;
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, RECONNECT_DELAY_MAX_MS);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        attemptAutoLogin();
    }, delay);
}

function setCredentialsVisible(visible) {
    document.getElementById("credentials").style.display = visible ? "block" : "none";
}

function setViewButtonVisible(visible) {
    const button = document.getElementById("toggle-completed");
    if (button) button.style.display = visible ? "inline-block" : "none";
}

function setOrderView(nextView, notify = true) {
    if (nextView !== ORDER_VIEW_ACTIVE && nextView !== ORDER_VIEW_COMPLETED) return;
    currentOrderView = nextView;
    window.currentOrderView = currentOrderView;
    const button = document.getElementById("toggle-completed");
    if (button) {
        button.textContent = currentOrderView === ORDER_VIEW_COMPLETED ? "Show Active" : "Show Completed";
    }
    if (notify && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: "set-order-view",
            value: currentOrderView
        }));
    }
}

function connect(token, auto = false) {
    return new Promise((resolve, reject) => {
        setConnectionStatus("Connecting...");
        logWith("log", "ws", `Connecting (auto=${auto})`);
        const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
        socket = new WebSocket(`${wsProtocol}://${window.location.host}/ws?token=${token}`);
        let settled = false;

        socket.onopen = () => {
            logWith("log", "ws", "Open");
            resetReconnectBackoff();
            setCredentialsVisible(false);
            setViewButtonVisible(true);
            setOrderView(ORDER_VIEW_ACTIVE, false);
            if (!settled) {
                settled = true;
                resolve();
            }
            setConnectionStatus("Connected");
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
                ordersCache = filterOrdersForView(normalizeOrders(data.value));
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
                const merged = mergeOrdersDelta(ordersCache, filterOrdersForView(normalizeOrders(data.value)));
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
                    ordersCache = filterOrdersForView(normalizeOrders(data.value));
                    window.ordersCache = ordersCache;
                    createCards(ordersCache);
                } else {
                    logWith("error", "ws", "Sync failed", data.error);
                }

            }

            if (data.type === "refresh") {
                setOrderView(currentOrderView, true);
            }
        };

        socket.onclose = (event) => {
            logWith("warn", "ws", "Closed");
            const code = event?.code ?? 0;
            if (code === 4001) {
                logWith("warn", "auth", "Token rejected or expired");
                clearAuthCookie();
                setConnectionStatus("Disconnected");
                setCredentialsVisible(true);
                setViewButtonVisible(false);
                setOrderView(ORDER_VIEW_ACTIVE, false);
                if (auto && !settled) {
                    settled = true;
                    reject();
                }
                return;
            }
            logWith("log", "ws", "Reconnecting (auto=" + auto + ")");
            scheduleReconnect();
            setConnectionStatus("Disconnected");
            if (auto && !settled) {
                settled = true;
                reject();
            }
            setCredentialsVisible(true);
            setViewButtonVisible(false);
            setOrderView(ORDER_VIEW_ACTIVE, false);
        };
    });

}
