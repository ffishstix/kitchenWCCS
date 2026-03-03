async function loadTopItems() {
    topTableBody.innerHTML = `<tr><td colspan="4" class="muted">Loading...</td></tr>`;
    try {
        const data = await api("/api/top-items?limit=5");
        if (!data.items.length) {
            topTableBody.innerHTML = `<tr><td colspan="4" class="muted">No sales data.</td></tr>`;
            return;
        }
        topTableBody.innerHTML = data.items
            .map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(item.itemName)} <span class="muted">#${item.itemId}</span></td>
                    <td>${item.soldCount}</td>
                    <td>${formatPrice(item.price)}</td>
                </tr>
            `)
            .join("");
    } catch (err) {
        topTableBody.innerHTML = `<tr><td colspan="4" class="muted">Failed to load.</td></tr>`;
    }
}
