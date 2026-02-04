let lastCardsData = null;
let resizeTimer = null;
const TIMER_CLASSES = ["timer-green", "timer-yellow", "timer-orange", "timer-red"];
const DISPLAY_TIMER_INTERVAL_MS = 1000;
let timerInterval = null;

function formatElapsedTime(ms) {
    const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
    const totalSeconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getTimerClass(ms) {
    const minutes = ms / 60000;
    if (minutes < 15) return "timer-green";
    if (minutes < 20) return "timer-yellow";
    if (minutes < 25) return "timer-orange";
    return "timer-red";
}

function parseActiveAtMs(value) {
    if (value == null) return null;
    const date = value instanceof Date ? value : new Date(value);
    const ms = date.getTime();
    return Number.isNaN(ms) ? null : ms;
}

function resolveActiveAtMs(value) {
    const parsed = parseActiveAtMs(value);
    return parsed != null ? parsed : Date.now();
}

function updateDisplayedTimers() {
    if (window.currentOrderView === "completed") return;
    const timeEls = document.querySelectorAll(".order-time time[data-order-id]");
    if (!timeEls.length) return;
    const now = Date.now();
    for (const timeEl of timeEls) {
        const activeAtMs = Number(timeEl.dataset.activeAt);
        const safeActiveAt = Number.isFinite(activeAtMs) ? activeAtMs : now;
        const elapsed = Math.max(0, now - safeActiveAt);
        const nextClass = getTimerClass(elapsed);
        timeEl.textContent = formatElapsedTime(elapsed);
        timeEl.classList.remove(...TIMER_CLASSES);
        timeEl.classList.add(nextClass);
    }
}
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
    container.style.setProperty("--orders-grid-height", `${height}px`);
    return height;
}

function setOrderBodyMaxHeight(card, header, footer, body, maxCardHeight) {
    if (!card || !header || !footer || !body || !maxCardHeight) return;
    const cardStyles = getComputedStyle(card);
    const borderTop = parseFloat(cardStyles.borderTopWidth || "0");
    const borderBottom = parseFloat(cardStyles.borderBottomWidth || "0");
    const available = maxCardHeight - header.offsetHeight - footer.offsetHeight - borderTop - borderBottom;
    body.style.maxHeight = `${Math.max(0, Math.floor(available))}px`;
}

function createOrderColumn(container) {
    const column = document.createElement("div");
    column.className = "orders-column";
    container.appendChild(column);
    return column;
}

function finalizeColumnCard(column, card, maxHeight, containerRef) {
    if (!column || !card) return { column };
    if (column.childElementCount > 1 && column.scrollHeight > maxHeight) {
        column.removeChild(card);
        const nextColumn = createOrderColumn(containerRef);
        nextColumn.appendChild(card);
        return { column: nextColumn };
    }
    return { column };
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

function buildOrderFooter(order, isCompletedView) {
    const footer = document.createElement("div");
    footer.className = "order-footer";

    if (!isCompletedView) {
        const orderTime = document.createElement("div");
        orderTime.className = "order-time";

        const label = document.createElement("span");
        label.textContent = "Time active: ";

        const timeEl = document.createElement("time");
        timeEl.dataset.orderId = String(order.orderId);
        const activeAtMs = resolveActiveAtMs(order.activeAtMs);
        timeEl.dataset.activeAt = String(activeAtMs);
        const elapsed = Math.max(0, Date.now() - activeAtMs);
        timeEl.textContent = formatElapsedTime(elapsed);
        timeEl.classList.add(getTimerClass(elapsed));

        orderTime.appendChild(label);
        orderTime.appendChild(timeEl);
        footer.appendChild(orderTime);
    }

    const button = document.createElement("button");
    button.className = "order-button";
    button.textContent = isCompletedView ? "Uncomplete Order" : "Complete Order";
    button.dataset.orderId = String(order.orderId);
    if (isCompletedView) {
        button.addEventListener("click", () => unfinishOrder(order.orderId, button));
    } else {
        button.addEventListener("click", () => finishOrder(order.orderId, button));
    }

    footer.appendChild(button);

    return footer;
}

function buildOrderCard(order, isContinued, isCompletedView) {
    const card = document.createElement("div");
    card.className = "order-card";

    const header = buildOrderHeader(order, isContinued);
    const body = document.createElement("div");
    body.className = "order-body";
    const footer = buildOrderFooter(order, isCompletedView);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    return { card, body, header, footer };
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
    const maxCardHeight = setOrderCardHeight(container);
    container.textContent = "";
    const orders = new Map();

    for (const row of deduped) {
        if (!row || row.orderId == null) continue;

        let order = orders.get(row.orderId);
        if (!order) {
            const activeAtMs = resolveActiveAtMs(row.activeAt ?? row.sentDateTime);
            order = {
                orderId: row.orderId,
                staffName: row.staffName,
                tableNumber: row.tableNumber,
                sentDateTime: row.sentDateTime,
                activeAtMs,
                items: [],
                lastItem: null
            };
            orders.set(row.orderId, order);
        } else if (order.activeAtMs == null) {
            const activeAtMs = parseActiveAtMs(row.activeAt ?? row.sentDateTime);
            if (activeAtMs != null) order.activeAtMs = activeAtMs;
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

    const isCompletedView = window.currentOrderView === "completed";
    let column = createOrderColumn(container);
    for (const order of orders.values()) {
        let { card, body, header, footer } = buildOrderCard(order, false, isCompletedView);
        column.appendChild(card);
        setOrderBodyMaxHeight(card, header, footer, body, maxCardHeight);
        let cardIndex = 1;

        for (const item of order.items) {
            const itemEl = buildItemElement(item);
            body.appendChild(itemEl);

            if (body.scrollHeight > body.clientHeight) {
                body.removeChild(itemEl);
                ({ column } = finalizeColumnCard(column, card, maxCardHeight, container));
                const nextCard = buildOrderCard(order, true, isCompletedView);
                column.appendChild(nextCard.card);
                setOrderBodyMaxHeight(nextCard.card, nextCard.header, nextCard.footer, nextCard.body, maxCardHeight);
                logWith("log", "cards", "Continued order", { orderId: order.orderId, cardIndex });
                cardIndex += 1;
                card = nextCard.card;
                body = nextCard.body;
                body.appendChild(itemEl);

                if (body.scrollHeight > body.clientHeight && body.childElementCount === 1) {
                    logWith("warn", "cards", "Item too tall for card", { orderId: order.orderId });
                    body.style.overflowY = "auto";
                }
            }
        }
        ({ column } = finalizeColumnCard(column, card, maxCardHeight, container));
    }

    const shouldRunTimers = !isCompletedView && orders.size > 0;
    if (shouldRunTimers) {
        updateDisplayedTimers();
    }
    if (shouldRunTimers && !timerInterval) {
        timerInterval = setInterval(updateDisplayedTimers, DISPLAY_TIMER_INTERVAL_MS);
    } else if (!shouldRunTimers && timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
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

async function unfinishOrder(orderId, button) {
    const id = Number(orderId);
    if (!Number.isInteger(id)) {
        logWith("warn", "order", "Invalid orderId", orderId);
        return;
    }

    if (button) button.disabled = true;
    try {
        const res = await fetch("/api/unfinish-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: id })
        });

        if (!res.ok) {
            logWith("error", "order", "Failed to unfinish order", id);
            return;
        }

        const data = await res.json();
        if (!data.success) {
            logWith("error", "order", "Unfinish order rejected", id);
            return;
        }

        logWith("log", "order", "Unfinished", id);
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
        logWith("error", "order", "Unfinish order error", err);
    } finally {
        if (button) button.disabled = false;
    }
}

window.addEventListener("resize", () => {
    if (!lastCardsData) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => createCards(lastCardsData), 150);
});
