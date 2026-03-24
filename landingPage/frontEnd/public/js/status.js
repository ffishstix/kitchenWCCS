function setStatus(state, text, tooltip) {
    if (!statusPill || !statusDot || !statusText) return;
    statusPill.classList.remove("ok", "warn", "offline");
    statusDot.classList.remove("ok", "warn", "offline");
    if (state) {
        statusPill.classList.add(state);
        statusDot.classList.add(state);
    }
    statusText.textContent = text;
    statusPill.title = tooltip || "";
}

function formatEntry(name, entry) {
    if (!entry) return `${name}: unknown`;
    if (entry.ok) {
        if (entry.statusCode) return `${name}: ${entry.statusCode}`;
        return `${name}: ok`;
    }
    if (entry.statusCode) return `${name}: ${entry.statusCode}`;
    if (entry.error) return `${name}: ${entry.error}`;
    return `${name}: down`;
}

function applyStatus(data) {
    const portfolioOk = Boolean(data?.portfolio?.ok);
    const displayOk = Boolean(data?.display?.ok);
    const adminOk = Boolean(data?.admin?.ok);
    const dbOk = Boolean(data?.database?.ok);
    const anyOk = portfolioOk || displayOk || adminOk || dbOk;
    const allOk = portfolioOk && displayOk && adminOk && dbOk;

    const details = [
        formatEntry("Portfolio", data?.portfolio),
        formatEntry("Kitchen", data?.display),
        formatEntry("Admin", data?.admin),
        formatEntry("DB", data?.database)
    ];

    if (data?.checkedAt) {
        details.push(`Checked: ${data.checkedAt}`);
    }

    if (allOk) {
        setStatus("ok", "All systems online", details.join(" | "));
    } else if (anyOk) {
        setStatus("warn", "Some systems degraded", details.join(" | "));
    } else {
        setStatus("offline", "Services unavailable", details.join(" | "));
    }
}

async function refreshStatus() {
    try {
        const res = await fetch(STATUS_ENDPOINT, { cache: "no-store" });
        const data = await res.json();
        applyStatus(data);
    } catch (err) {
        setStatus("offline", "Status unavailable", err?.message ? `Status: ${err.message}` : "");
    }
}
