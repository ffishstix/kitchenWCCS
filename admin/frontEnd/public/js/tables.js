const OPEN_TABLE_FILTERS = {
    all: () => true,
    ready: table => Number(table.finished) === 1,
    kitchen: table => Number(table.finished) === 0
};

function formatOpenTableLabel(tableNumber) {
    const raw = String(tableNumber ?? "").trim();
    if (!raw) return "No table";
    return `Table ${raw}`;
}

function getOpenTableStatusMeta(finished) {
    const value = Number(finished);
    if (value === 1) {
        return {label: "Ready", className: "ready"};
    }
    if (value === 0) {
        return {label: "In kitchen", className: "kitchen"};
    }
    return {label: "Unknown", className: "unknown"};
}

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return "<1m";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const days = Math.floor(hours / 24);
    const hrs = hours % 24;
    if (days > 0) return `${days}d ${hrs}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${minutes}m`;
}

function formatOpenTableAge(sentDateTime) {
    if (!sentDateTime) return "-";
    const date = new Date(sentDateTime);
    if (Number.isNaN(date.getTime())) return "-";
    const diff = Date.now() - date.getTime();
    if (diff < 0) return "Just now";
    return formatDuration(diff);
}

function getOldestOpenMs(tables) {
    let oldest = null;
    for (const table of tables) {
        const date = new Date(table?.sentDateTime);
        const ms = date.getTime();
        if (Number.isNaN(ms)) continue;
        if (oldest == null || ms < oldest) oldest = ms;
    }
    return oldest;
}

function renderOpenTableSummary(tables) {
    if (!openTableSummary) return;
    if (!Array.isArray(tables)) {
        openTableSummary.innerHTML = "";
        return;
    }

    const total = tables.length;
    const ready = tables.filter(table => Number(table.finished) === 1).length;
    const kitchen = tables.filter(table => Number(table.finished) === 0).length;
    const totalValue = tables.reduce((sum, table) => sum + (Number(table.grossTotal) || 0), 0);
    const averageValue = total > 0 ? Math.round(totalValue / total) : 0;
    const oldestMs = getOldestOpenMs(tables);
    const oldestLabel = oldestMs == null ? "" : new Date(oldestMs).toLocaleString();
    const oldestAge = oldestMs == null ? "-" : formatDuration(Date.now() - oldestMs);
    const oldestSub = oldestLabel || "No open tables";

    openTableSummary.innerHTML = `
        <div class="summary-card">
            <div class="summary-label">Open tables</div>
            <div class="summary-value">${total}</div>
            <div class="summary-sub">${ready} ready · ${kitchen} in kitchen</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Open revenue</div>
            <div class="summary-value">${formatPrice(totalValue)}</div>
            <div class="summary-sub">Avg ${formatPrice(averageValue)}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Oldest open</div>
            <div class="summary-value" ${oldestLabel ? `title="${escapeHtml(oldestLabel)}"` : ""}>${oldestAge}</div>
            <div class="summary-sub">${escapeHtml(oldestSub)}</div>
        </div>
    `;
}

function isOpenTableStale(sentDateTime) {
    if (!sentDateTime) return false;
    const date = new Date(sentDateTime);
    const ms = date.getTime();
    if (Number.isNaN(ms)) return false;
    return Date.now() - ms > 45 * 60 * 1000;
}

function renderOpenTables() {
    if (!openTableBody) return;
    const tables = Array.isArray(state.openTables) ? state.openTables : [];
    renderOpenTableSummary(tables);

    const filterKey = state.openTableFilter || "all";
    const filterFn = OPEN_TABLE_FILTERS[filterKey] || OPEN_TABLE_FILTERS.all;
    const filtered = tables.filter(filterFn);

    if (!filtered.length) {
        const message = tables.length ? "No tables match this filter." : "No open tables.";
        openTableBody.innerHTML = `<tr><td colspan="7" class="muted">${message}</td></tr>`;
        return;
    }

    openTableBody.innerHTML = filtered
        .map(table => {
            const label = formatOpenTableLabel(table.tableNumber);
            const status = getOpenTableStatusMeta(table.finished);
            const itemCount = Number(table.itemCount) || 0;
            const orderCount = Number(table.orderCount) || 0;
            const total = formatPrice(table.grossTotal);
            const opened = formatOpenTableAge(table.sentDateTime);
            const openedTitle = table.sentDateTime ? new Date(table.sentDateTime).toLocaleString() : "";
            const staffName = table.staffName ? escapeHtml(table.staffName) : "Unassigned";
            const staffId = Number(table.staffId);
            const staffLabel = Number.isInteger(staffId) ? `#${staffId}` : "No staff";
            const isStale = isOpenTableStale(table.sentDateTime);

            return `
                <tr class="${isStale ? "stale" : ""}">
                    <td>
                        <div class="cell-stack">
                            <div>${escapeHtml(label)}</div>
                            <div class="muted">#${table.headerId}</div>
                        </div>
                    </td>
                    <td>
                        <div class="cell-stack">
                            <div>${staffName}</div>
                            <div class="muted">${staffLabel}</div>
                        </div>
                    </td>
                    <td><span class="status-pill ${status.className}">${status.label}</span></td>
                    <td>
                        <div class="cell-stack">
                            <div>${itemCount}</div>
                            <div class="muted">${orderCount} orders</div>
                        </div>
                    </td>
                    <td>${total}</td>
                    <td title="${escapeHtml(openedTitle)}">${opened}</td>
                    <td>
                        <button class="btn small primary" data-finish-id="${table.headerId}">Close</button>
                    </td>
                </tr>
            `;
        })
        .join("");
}

async function loadOpenTables() {
    if (!openTableBody) return;
    openTableBody.innerHTML = `<tr><td colspan="7" class="muted">Loading...</td></tr>`;
    try {
        const data = await api("/api/open-tables");
        state.openTables = data.tables || [];
        if (openTableFilter) {
            openTableFilter.value = state.openTableFilter || "all";
        }
        renderOpenTables();
    } catch (err) {
        openTableBody.innerHTML = `<tr><td colspan="7" class="muted">Failed to load.</td></tr>`;
        if (openTableSummary) openTableSummary.innerHTML = "";
    }
}

async function handleOpenTableClick(event) {
    const button = event.target.closest("button[data-finish-id]");
    if (!button) return;
    const headerId = Number(button.dataset.finishId);
    if (!Number.isInteger(headerId)) return;

    const table = state.openTables.find(item => Number(item.headerId) === headerId);
    const label = table ? formatOpenTableLabel(table.tableNumber) : `Header #${headerId}`;
    if (!confirm(`Close ${label}?`)) return;

    button.disabled = true;
    try {
        await api(`/api/headers/${headerId}/finish`, {method: "PATCH"});
        showToast(`${label} closed`);
        await loadOpenTables();
    } catch (err) {
        showToast(err.message || "Close failed", "error");
        button.disabled = false;
    }
}
