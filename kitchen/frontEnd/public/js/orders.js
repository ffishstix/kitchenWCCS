function normalizeOrders(value) {
    return Array.isArray(value) ? value : [];
}

function filterOrdersForView(items) {
    if (!Array.isArray(items)) return [];
    const target = currentOrderView === ORDER_VIEW_COMPLETED ? 1 : 0;
    return items.filter(item => {
        if (!item || item.finished == null) return true;
        return Number(item.finished) === target;
    });
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
        value: ordersCache,
        view: currentOrderView
    }));
}

window.setOrdersCache = (next) => {
    ordersCache = Array.isArray(next) ? next : [];
    window.ordersCache = ordersCache;
    createCards(ordersCache);
};
