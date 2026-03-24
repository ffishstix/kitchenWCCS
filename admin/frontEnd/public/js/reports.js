function renderReportChips() {
    reportCategoryChips.innerHTML = state.reportCategories
        .map(item => `
            <span class="chip">
                ${escapeHtml(item.name)} #${item.id}
                <button data-type="category" data-id="${item.id}" aria-label="Remove">&times;</button>
            </span>
        `)
        .join("");

    reportItemChips.innerHTML = state.reportItems
        .map(item => `
            <span class="chip">
                ${escapeHtml(item.name)} #${item.id}
                <button data-type="item" data-id="${item.id}" aria-label="Remove">&times;</button>
            </span>
        `)
        .join("");
}

function addReportFilter(type, entry) {
    const list = type === "category" ? state.reportCategories : state.reportItems;
    if (list.some(item => item.id === entry.id)) return;
    list.push(entry);
    renderReportChips();
}

function removeReportFilter(type, id) {
    if (type === "category") {
        state.reportCategories = state.reportCategories.filter(item => item.id !== id);
    } else {
        state.reportItems = state.reportItems.filter(item => item.id !== id);
    }
    renderReportChips();
}

async function searchReportCategories() {
    const term = reportCategorySearch.value.trim();
    if (!term) {
        reportCategoryResults.innerHTML = `<li class="muted">Type to search.</li>`;
        return;
    }
    reportCategoryResults.innerHTML = `<li class="muted">Searching...</li>`;
    try {
        const data = await api(`/api/categories?search=${encodeURIComponent(term)}&limit=20`);
        if (!data.categories.length) {
            reportCategoryResults.innerHTML = `<li class="muted">No categories found.</li>`;
            return;
        }
        reportCategoryResults.innerHTML = data.categories
            .map(category => `
                <li data-id="${category.categoryId}" data-name="${escapeHtml(category.catName)}">
                    ${escapeHtml(category.catName)}
                    <span class="muted">#${category.categoryId}</span>
                </li>
            `)
            .join("");
    } catch (err) {
        reportCategoryResults.innerHTML = `<li class="muted">Search failed.</li>`;
    }
}

async function searchReportItems() {
    const term = reportItemSearch.value.trim();
    if (!term) {
        reportItemResults.innerHTML = `<li class="muted">Type to search.</li>`;
        return;
    }
    reportItemResults.innerHTML = `<li class="muted">Searching...</li>`;
    try {
        const data = await api(`/api/items?search=${encodeURIComponent(term)}&limit=20`);
        if (!data.items.length) {
            reportItemResults.innerHTML = `<li class="muted">No items found.</li>`;
            return;
        }
        reportItemResults.innerHTML = data.items
            .map(item => `
                <li data-id="${item.itemId}" data-name="${escapeHtml(item.itemName)}">
                    ${escapeHtml(item.itemName)}
                    <span class="muted">#${item.itemId}</span>
                </li>
            `)
            .join("");
    } catch (err) {
        reportItemResults.innerHTML = `<li class="muted">Search failed.</li>`;
    }
}

// Render report rows and summary totals.
function renderReportResults(items) {
    if (!items.length) {
        reportTableBody.innerHTML = `<tr><td colspan="5" class="muted">No results for this selection.</td></tr>`;
        reportSummary.textContent = "No results.";
        return;
    }

    let totalSold = 0;
    let totalRevenue = 0;

    reportTableBody.innerHTML = items
        .map(row => {
            const soldCount = Number(row.soldCount) || 0;
            const revenue = Number(row.grossRevenue) || 0;
            totalSold += soldCount;
            totalRevenue += revenue;
            const categoryName = row.catName ? `${row.catName} #${row.categoryId}` : "Uncategorised";
            return `
                <tr>
                    <td>${escapeHtml(row.itemName)} <span class="muted">#${row.itemId}</span></td>
                    <td>${escapeHtml(categoryName)}</td>
                    <td>${soldCount}</td>
                    <td>${formatPrice(row.price)}</td>
                    <td>${formatPrice(revenue)}</td>
                </tr>
            `;
        })
        .join("");

    reportSummary.textContent = `Total sold: ${totalSold} \u00B7 Revenue: ${formatPrice(totalRevenue)}`;
}

// Build query params, run the report, and render results.
async function runReport() {
    const params = new URLSearchParams();
    if (reportStartInput.value) params.set("start", `${reportStartInput.value}T00:00:00`);
    if (reportEndInput.value) params.set("end", `${reportEndInput.value}T23:59:59.999`);
    if (state.reportCategories.length) {
        params.set("categories", state.reportCategories.map(item => item.id).join(","));
    }
    if (state.reportItems.length) {
        params.set("items", state.reportItems.map(item => item.id).join(","));
    }

    reportTableBody.innerHTML = `<tr><td colspan="5" class="muted">Loading...</td></tr>`;
    reportSummary.textContent = "";

    try {
        const query = params.toString();
        const url = query ? `/api/report?${query}` : "/api/report";
        const data = await api(url);
        renderReportResults(data.items || []);
    } catch (err) {
        reportTableBody.innerHTML = `<tr><td colspan="5" class="muted">Report failed.</td></tr>`;
        reportSummary.textContent = "";
    }
}

// Reset report filters to the default date range.
function clearReportFilters() {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    reportStartInput.value = formatDateInput(weekAgo);
    reportEndInput.value = formatDateInput(today);
    reportCategorySearch.value = "";
    reportItemSearch.value = "";
    state.reportCategories = [];
    state.reportItems = [];
    reportCategoryResults.innerHTML = "";
    reportItemResults.innerHTML = "";
    renderReportChips();
    reportTableBody.innerHTML = `<tr><td colspan="5" class="muted">Run a report to view results.</td></tr>`;
    reportSummary.textContent = "";
}
