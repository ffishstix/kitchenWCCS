function formatOrderTime(sentDateTime) {
    if (!sentDateTime) return "--:--";
    const date = new Date(sentDateTime);
    if (Number.isNaN(date.getTime())) return "--:--";
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}

let lastCardsData = null;
let resizeTimer = null;
function getOrderCardHeight(container) {
    if (!container) return 320;
    const bodyStyles = getComputedStyle(document.body);
    const paddingTop = parseFloat(bodyStyles.paddingTop || "0");
    const paddingBottom = parseFloat(bodyStyles.paddingBottom || "0");
    const header = document.querySelector(".header");
    const headerStyles = header ? getComputedStyle(header) : null;
    const headerHeight = header ? header.offsetHeight : 0;
    const headerMarginBottom = headerStyles ? parseFloat(headerStyles.marginBottom || "0") : 0;
    const available = window.innerHeight - headerHeight - headerMarginBottom - paddingTop - paddingBottom - 10;
    return Math.max(220, Math.floor(available));
}

function setOrderCardHeight(container) {
    const height = getOrderCardHeight(container);
    container.style.setProperty("--order-card-height", `${height}px`);
    return height;
}

function buildOrderHeader(order, isContinued) {
    const header = document.createElement("div");
    header.className = "order-header";

    if (isContinued) {
        const continuedLine = document.createElement("div");
        continuedLine.className = "order-continued";
        continuedLine.textContent = "Continued";
        header.appendChild(continuedLine);
    }

    const tableLine = document.createElement("div");
    tableLine.textContent = `Table: ${order.tableNumber ?? ""}`;
    header.appendChild(tableLine);

    const staffLine = document.createElement("div");
    staffLine.textContent = `Staff: ${order.staffName ?? ""}`;
    header.appendChild(staffLine);

    const idLine = document.createElement("div");
    idLine.textContent = `Order ID: ${order.orderId}`;
    header.appendChild(idLine);

    return header;
}

function buildOrderFooter(order) {
    const footer = document.createElement("div");
    footer.className = "order-footer";

    const orderTime = document.createElement("div");
    orderTime.className = "order-time";

    const label = document.createElement("span");
    label.textContent = "Time of order: ";

    const timeEl = document.createElement("time");
    timeEl.textContent = formatOrderTime(order.sentDateTime);
    if (order.sentDateTime) {
        const date = new Date(order.sentDateTime);
        if (!Number.isNaN(date.getTime())) {
            timeEl.dateTime = date.toISOString();
        }
    }

    orderTime.appendChild(label);
    orderTime.appendChild(timeEl);

    const button = document.createElement("button");
    button.className = "order-button";
    button.textContent = "Complete Order";
    button.dataset.orderId = String(order.orderId);
    button.addEventListener("click", () => finishOrder(order.orderId, button));

    footer.appendChild(orderTime);
    footer.appendChild(button);

    return footer;
}

function buildOrderCard(order, isContinued) {
    const card = document.createElement("div");
    card.className = "order-card";

    const header = buildOrderHeader(order, isContinued);
    const body = document.createElement("div");
    body.className = "order-body";
    const footer = buildOrderFooter(order);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    return { card, body };
}

function buildItemElement(item) {
    const itemEl = document.createElement("div");
    itemEl.className = "item";

    const nameEl = document.createElement("div");
    nameEl.className = "item-name";
    nameEl.textContent = item.name ?? "";
    itemEl.appendChild(nameEl);

    for (const msg of item.messages) {
        const messageEl = document.createElement("div");
        messageEl.className = "item-comment";
        messageEl.textContent = msg;
        itemEl.appendChild(messageEl);
    }

    return itemEl;
}

function createCards(cardsData) {
    const container = document.querySelector(".orders-grid");
    if (!container || !Array.isArray(cardsData)) return;

    const deduped = [];
    const seen = new Set();
    for (const row of cardsData) {
        const lineId = Number(row?.orderLineId);
        if (Number.isInteger(lineId)) {
            if (seen.has(lineId)) continue;
            seen.add(lineId);
        }
        deduped.push(row);
    }

    lastCardsData = deduped;
    setOrderCardHeight(container);
    container.textContent = "";
    const orders = new Map();

    for (const row of deduped) {
        if (!row || row.orderId == null) continue;

        let order = orders.get(row.orderId);
        if (!order) {
            order = {
                orderId: row.orderId,
                staffName: row.staffName,
                tableNumber: row.tableNumber,
                sentDateTime: row.sentDateTime,
                items: [],
                lastItem: null
            };
            orders.set(row.orderId, order);
        }

        const name = row.itemName != null && String(row.itemName).trim() !== "" ? String(row.itemName) : null;
        const message = row.message != null && String(row.message).trim() !== "" ? String(row.message) : null;

        if (name) {
            const item = { name, messages: [] };
            if (message) item.messages.push(message);
            order.items.push(item);
            order.lastItem = item;
        } else if (message && order.lastItem) {
            order.lastItem.messages.push(message);
        }
    }

    for (const order of orders.values()) {
        let { card, body } = buildOrderCard(order, false);
        container.appendChild(card);
        let cardIndex = 1;

        for (const item of order.items) {
            const itemEl = buildItemElement(item);
            body.appendChild(itemEl);

            if (body.scrollHeight > body.clientHeight) {
                body.removeChild(itemEl);
                const nextCard = buildOrderCard(order, true);
                container.appendChild(nextCard.card);
                logWith("log", "cards", "Continued order", { orderId: order.orderId, cardIndex });
                cardIndex += 1;
                body = nextCard.body;
                body.appendChild(itemEl);

                if (body.scrollHeight > body.clientHeight && body.childElementCount === 1) {
                    logWith("warn", "cards", "Item too tall for card", { orderId: order.orderId });
                    body.style.overflowY = "auto";
                }
            }
        }
    }

    if (orders.size === 0) logWith("warn", "cards", "No orders to display");
    else logWith("log", "cards", "Created", orders.size);

}


async function finishOrder(orderId, button) {
    const id = Number(orderId);
    if (!Number.isInteger(id)) {
        logWith("warn", "order", "Invalid orderId", orderId);
        return;
    }

    if (button) button.disabled = true;
    try {
        const res = await fetch("/api/finish-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: id })
        });

        if (!res.ok) {
            logWith("error", "order", "Failed to finish order", id);
            return;
        }

        const data = await res.json();
        if (!data.success) {
            logWith("error", "order", "Finish order rejected", id);
            return;
        }

        logWith("log", "order", "Finished", id);
        const cache = Array.isArray(window.ordersCache) ? window.ordersCache : lastCardsData;
        if (Array.isArray(cache)) {
            const filtered = cache.filter(item => item?.orderId !== id);
            if (typeof window.setOrdersCache === "function") {
                window.setOrdersCache(filtered);
            } else {
                createCards(filtered);
            }
        } else if (button) {
            const card = button.closest(".order-card");
            if (card) card.remove();
        }
    } catch (err) {
        logWith("error", "order", "Finish order error", err);
    } finally {
        if (button) button.disabled = false;
    }
}

window.addEventListener("resize", () => {
    if (!lastCardsData) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => createCards(lastCardsData), 150);
});
