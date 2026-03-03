async function searchCategories(term, container, onSelect) {
    container.innerHTML = `<li class="muted">Searching...</li>`;
    try {
        const data = await api(`/api/categories?search=${encodeURIComponent(term)}&limit=20`);
        if (!data.categories.length) {
            container.innerHTML = `<li class="muted">No categories.</li>`;
            return;
        }
        container.innerHTML = data.categories
            .map(cat => `
                <li data-id="${cat.categoryId}" data-name="${escapeHtml(cat.catName)}">
                    ${escapeHtml(cat.catName)} <span class="muted">#${cat.categoryId}</span>
                </li>
            `)
            .join("");

        for (const li of container.querySelectorAll("li")) {
            li.addEventListener("click", () => {
                const id = Number.parseInt(li.dataset.id, 10);
                if (Number.isInteger(id)) {
                    const name = li.textContent.replace(/#\d+/, "").trim();
                    onSelect?.({id, name});
                }
            });
        }
    } catch (err) {
        container.innerHTML = `<li class="muted">Search failed.</li>`;
    }
}

async function searchAllergies(term, container, onSelect) {
    container.innerHTML = `<li class="muted">Searching...</li>`;
    try {
        const data = await api(`/api/allergies?search=${encodeURIComponent(term)}&limit=20&sort=name`);
        if (!data.allergies.length) {
            container.innerHTML = `<li class="muted">No allergies.</li>`;
            return;
        }
        container.innerHTML = data.allergies
            .map(allergy => `
                <li data-id="${allergy.allergyId}" data-name="${escapeHtml(allergy.allergyName)}">
                    ${escapeHtml(allergy.allergyName)} <span class="muted">#${allergy.allergyId}</span>
                </li>
            `)
            .join("");

        for (const li of container.querySelectorAll("li")) {
            li.addEventListener("click", () => {
                const id = Number.parseInt(li.dataset.id, 10);
                if (Number.isInteger(id)) {
                    const name = li.textContent.replace(/#\d+/, "").trim();
                    onSelect?.({id, name});
                }
            });
        }
    } catch (err) {
        container.innerHTML = `<li class="muted">Search failed.</li>`;
    }
}

async function searchItemsForAssign(term, container, onSelect) {
    container.innerHTML = `<li class="muted">Searching...</li>`;
    try {
        const data = await api(`/api/items?search=${encodeURIComponent(term)}&limit=20`);
        if (!data.items.length) {
            container.innerHTML = `<li class="muted">No items.</li>`;
            return;
        }
        container.innerHTML = data.items
            .map(item => `
                <li data-id="${item.itemId}" data-name="${escapeHtml(item.itemName)}">
                    ${escapeHtml(item.itemName)} <span class="muted">#${item.itemId}</span>
                </li>
            `)
            .join("");

        for (const li of container.querySelectorAll("li")) {
            li.addEventListener("click", () => {
                const id = Number.parseInt(li.dataset.id, 10);
                if (Number.isInteger(id)) {
                    const name = li.textContent.replace(/#\d+/, "").trim();
                    onSelect?.({id, name});
                }
            });
        }
    } catch (err) {
        container.innerHTML = `<li class="muted">Search failed.</li>`;
    }
}
