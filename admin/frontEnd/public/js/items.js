async function searchItems() {
    const term = itemSearchInput.value.trim();
    itemResults.innerHTML = `<li class="muted">Searching...</li>`;
    try {
        const data = await api(`/api/items?search=${encodeURIComponent(term)}&limit=50`);
        state.items = data.items;
        if (!state.items.length) {
            itemResults.innerHTML = `<li class="muted">No items found.</li>`;
            return;
        }
        itemResults.innerHTML = state.items
            .map(item => `
                <li data-id="${item.itemId}">
                    ${escapeHtml(item.itemName)}
                    <span class="muted">#${item.itemId}</span>
                </li>
            `)
            .join("");
    } catch (err) {
        itemResults.innerHTML = `<li class="muted">Search failed.</li>`;
    }
}

async function createItem(useTemplate = null) {
    const fromTemplate = useTemplate === null ? state.createMode.item : useTemplate;
    const name = (fromTemplate
        ? getInputValueById("item-new-name", itemCreateName)
        : itemCreateName.value
    ).trim();
    const priceValue = (fromTemplate
        ? getInputValueById("item-new-price", itemCreatePrice)
        : itemCreatePrice.value
    ).trim();
    const price = Number.parseInt(priceValue, 10);

    if (!name) {
        showToast("Enter an item name", "error");
        return;
    }
    if (!Number.isInteger(price)) {
        showToast("Enter a valid price (pence)", "error");
        return;
    }

    const payload = {itemName: name, price};
    if (fromTemplate) {
        const chosenColour = getInputValueById("item-new-colour").trim();
        if (chosenColour && !isValidColorName(chosenColour)) {
            showToast("Choose a valid C# Color", "error");
            return;
        }
        payload.chosenColour = chosenColour;
        payload.extraInfo = getInputValueById("item-new-extra").trim();
        payload.madeInKitchen = getInputValueById("item-new-made");
    }

    try {
        const data = await api("/api/items", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        itemCreateName.value = "";
        itemCreatePrice.value = "";
        updateItemCreateButtons();
        await searchItems();
        if (data.item?.itemId) {
            selectItem(data.item.itemId);
        } else if (state.createMode.item) {
            renderItemCreateTemplate();
        }
        showToast("Item added");
    } catch (err) {
        showToast(err.message || "Item create failed", "error");
    }
}

function isItemCreateReady() {
    const name = getInputValueById("item-new-name", itemCreateName).trim();
    const priceValue = getInputValueById("item-new-price", itemCreatePrice).trim();
    const price = Number.parseInt(priceValue, 10);
    return Boolean(name) && Number.isInteger(price);
}

function updateItemCreateButtons() {
    const ready = isItemCreateReady();
    itemCreateBtn.disabled = !ready;
    const templateButton = document.getElementById("item-template-create");
    if (templateButton) templateButton.disabled = !ready;
}

function renderItemCreateTemplate() {
    state.createMode.item = true;
    state.selectedItemId = null;
    state.currentItem = null;
    clearActiveList(itemResults);

    const nameValue = itemCreateName.value.trim();
    const priceValue = itemCreatePrice.value.trim();

    itemDetail.innerHTML = `
        <div class="form-grid">
            <div class="form-field">
                <label class="label">Item name</label>
                <input id="item-new-name" value="${escapeHtml(nameValue)}" placeholder="New item name" />
            </div>
            <div class="form-field">
                <label class="label">Price (pence)</label>
                <input id="item-new-price" value="${escapeHtml(priceValue)}" placeholder="350" />
            </div>
            <div class="form-field">
                <label class="label">Colour</label>
                ${buildColorPicker("item-new-colour", "")}
            </div>
            <div class="form-field">
                <label class="label">Made in kitchen</label>
                <select id="item-new-made">
                    <option value="1" selected>Yes</option>
                    <option value="0">No</option>
                </select>
            </div>
            <div class="form-field" style="grid-column: 1 / -1;">
                <label class="label">Extra info</label>
                <textarea id="item-new-extra" placeholder="Optional notes"></textarea>
            </div>
        </div>
        <div class="actions" style="margin-top: 14px;">
            <button class="btn primary" id="item-template-create">Create item</button>
        </div>
        <div class="muted" style="margin-top: 12px;">Create the item before assigning categories or allergies.</div>
    `;

    initColorPicker("item-new-colour");
    wireItemCreateTemplate();
}

function wireItemCreateTemplate() {
    const nameInput = document.getElementById("item-new-name");
    const priceInput = document.getElementById("item-new-price");
    const createButton = document.getElementById("item-template-create");

    if (nameInput) {
        nameInput.addEventListener("input", () => {
            if (itemCreateName.value !== nameInput.value) {
                itemCreateName.value = nameInput.value;
            }
            updateItemCreateButtons();
        });
    }

    if (priceInput) {
        priceInput.addEventListener("input", () => {
            if (itemCreatePrice.value !== priceInput.value) {
                itemCreatePrice.value = priceInput.value;
            }
            updateItemCreateButtons();
        });
    }

    if (createButton) {
        createButton.addEventListener("click", () => createItem(true));
    }

    updateItemCreateButtons();
}

function syncItemCreateFromLeft() {
    if (!state.createMode.item) {
        updateItemCreateButtons();
        return;
    }
    const nameInput = document.getElementById("item-new-name");
    const priceInput = document.getElementById("item-new-price");
    if (nameInput && nameInput.value !== itemCreateName.value) {
        nameInput.value = itemCreateName.value;
    }
    if (priceInput && priceInput.value !== itemCreatePrice.value) {
        priceInput.value = itemCreatePrice.value;
    }
    updateItemCreateButtons();
}

function activateItemCreateTemplate() {
    if (!state.createMode.item) {
        renderItemCreateTemplate();
        return;
    }
    syncItemCreateFromLeft();
}

async function selectItem(itemId) {
    state.createMode.item = false;
    state.selectedItemId = itemId;
    for (const li of itemResults.querySelectorAll("li")) {
        li.classList.toggle("active", Number(li.dataset.id) === itemId);
    }

    itemDetail.innerHTML = `<div class="detail-empty">Loading item...</div>`;

    try {
        const data = await api(`/api/items/${itemId}`);
        renderItemDetail(data.item, data.categories || [], data.allergies || []);
    } catch (err) {
        itemDetail.innerHTML = `<div class="detail-empty">Failed to load item.</div>`;
    }
}

function getItemFieldValue(prefix, field) {
    const element = document.getElementById(`${prefix}-${field}`);
    return element ? element.value : "";
}

function getItemEditorSnapshot(prefix) {
    const nameInput = document.getElementById(`${prefix}-name`);
    const priceInput = document.getElementById(`${prefix}-price`);
    if (!nameInput || !priceInput) return null;
    return {
        name: nameInput.value.trim(),
        price: priceInput.value.trim(),
        colour: getItemFieldValue(prefix, "colour").trim(),
        extra: getItemFieldValue(prefix, "extra").trim(),
        made: getItemFieldValue(prefix, "made")
    };
}

function normalizeItemForCompare(item) {
    const madeValue = Number(item?.madeInKitchen) === 1 ? "1" : "0";
    return {
        name: String(item?.itemName ?? "").trim(),
        price: String(item?.price ?? "").trim(),
        colour: String(item?.chosenColour ?? "").trim(),
        extra: String(item?.extraInfo ?? "").trim(),
        made: madeValue
    };
}

function itemHasChanges(snapshot, currentItem) {
    if (!snapshot || !currentItem) return false;
    const current = normalizeItemForCompare(currentItem);
    return snapshot.name !== current.name
        || snapshot.price !== current.price
        || snapshot.colour !== current.colour
        || snapshot.extra !== current.extra
        || String(snapshot.made) !== current.made;
}

async function refreshItemDetail(itemId, target = "main") {
    const data = await api(`/api/items/${itemId}`);
    if (target === "main") {
        renderItemDetail(data.item, data.categories || [], data.allergies || []);
        return;
    }
    if (typeof target === "function") {
        await target(data.item, data.categories || [], data.allergies || []);
    }
}

async function saveItemFromEditor(prefix, itemId, currentItem, refreshFn) {
    const snapshot = getItemEditorSnapshot(prefix);
    if (!snapshot) return;
    if (!itemHasChanges(snapshot, currentItem)) return;

    const price = Number.parseInt(snapshot.price, 10);
    if (!Number.isInteger(price)) {
        showToast("Price must be a number", "error");
        return;
    }

    const chosenColour = snapshot.colour;
    if (chosenColour && !isValidColorName(chosenColour)) {
        showToast("Choose a valid C# Color", "error");
        return;
    }

    const payload = {
        itemName: snapshot.name,
        price,
        chosenColour,
        extraInfo: snapshot.extra,
        madeInKitchen: snapshot.made
    };

    try {
        await api(`/api/items/${itemId}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        });
        showUndo("Item updated", async () => {
            if (!currentItem) return;
            await api(`/api/items/${itemId}`, {
                method: "PATCH",
                body: JSON.stringify({
                    itemName: currentItem.itemName ?? "",
                    price: currentItem.price ?? 0,
                    chosenColour: currentItem.chosenColour ?? "",
                    extraInfo: currentItem.extraInfo ?? "",
                    madeInKitchen: currentItem.madeInKitchen ?? 0
                })
            });
            await refreshFn();
        });
        await refreshFn();
        await searchItems();
    } catch (err) {
        showToast(err.message || "Update failed", "error");
    }
}

async function deleteItem(itemId) {
    if (!Number.isInteger(itemId)) return;
    if (!confirm(`Delete item #${itemId}?`)) return;

    try {
        await api(`/api/items/${itemId}`, {method: "DELETE"});
        state.selectedItemId = null;
        state.currentItem = null;
        renderItemCreateTemplate();
        await searchItems();
        showToast("Item deleted");
    } catch (err) {
        showToast(err.message || "Delete failed", "error");
    }
}

function buildItemEditorMarkup(item, categories, allergies, prefix) {
    const categoryChips = buildCategoryChips(categories);
    const allergyChips = buildAllergyChips(allergies);
    const deleteButton = prefix === "item"
        ? `<button class="btn danger" id="${prefix}-delete">Delete item</button>`
        : "";
    return `
        <div class="form-grid">
            <div class="form-field">
                <label class="label">Item name</label>
                <input id="${prefix}-name" value="${escapeHtml(item.itemName ?? "")}" />
            </div>
            <div class="form-field">
                <label class="label">Price</label>
                <input id="${prefix}-price" value="${item.price ?? ""}" />
            </div>
            <div class="form-field">
                <label class="label">Colour</label>
                ${buildColorPicker(`${prefix}-colour`, item.chosenColour ?? "")}
            </div>
            <div class="form-field">
                <label class="label">Made in kitchen</label>
                <select id="${prefix}-made">
                    <option value="1" ${Number(item.madeInKitchen) === 1 ? "selected" : ""}>Yes</option>
                    <option value="0" ${Number(item.madeInKitchen) === 0 ? "selected" : ""}>No</option>
                </select>
            </div>
            <div class="form-field" style="grid-column: 1 / -1;">
                <label class="label">Extra info</label>
                <textarea id="${prefix}-extra">${escapeHtml(item.extraInfo ?? "")}</textarea>
            </div>
        </div>
        <div class="actions" style="margin-top: 14px;">
            <button class="btn primary" id="${prefix}-save">Save item changes</button>
            ${deleteButton}
        </div>

        <div style="margin-top: 20px;">
            <div class="label">Current categories</div>
            <div class="chips" id="${prefix}-current-categories" style="margin-top: 8px;">${categoryChips}</div>
        </div>

        <div style="margin-top: 16px;">
            <div class="label">Modify category</div>
            <div class="form-grid" style="margin-top: 8px;">
                <div class="form-field">
                    <label class="label">Category search</label>
                    <input id="${prefix}-category-search" placeholder="Search by name" />
                    <ul class="list" id="${prefix}-category-results" style="max-height: 160px;"></ul>
                </div>
            </div>
        </div>

        <div style="margin-top: 20px;">
            <div class="label">Current allergies</div>
            <div class="chips" id="${prefix}-current-allergies" style="margin-top: 8px;">${allergyChips}</div>
        </div>

        <div style="margin-top: 16px;">
            <div class="label">Add allergy</div>
            <div class="form-grid" style="margin-top: 8px;">
                <div class="form-field">
                    <label class="label">Allergy search</label>
                    <input id="${prefix}-allergy-search" placeholder="Search by name" />
                    <ul class="list" id="${prefix}-allergy-results" style="max-height: 160px;"></ul>
                </div>
            </div>
        </div>
    `;
}

function attachCategoryChipRemoval(container, itemId, refreshFn) {
    container.addEventListener("click", async event => {
        const button = event.target.closest("button");
        if (!button) return;
        const categoryId = Number.parseInt(button.dataset.categoryId, 10);
        if (!Number.isInteger(categoryId)) return;
        try {
            await api(`/api/items/${itemId}/category/remove`, {
                method: "POST",
                body: JSON.stringify({categoryId})
            });
            showUndo("Category removed", async () => {
                await api(`/api/items/${itemId}/category/add`, {
                    method: "POST",
                    body: JSON.stringify({categoryId})
                });
                await refreshFn();
            });
            await refreshFn();
        } catch (err) {
            showToast(err.message || "Remove failed", "error");
        }
    });
}

function attachAllergyChipRemoval(container, itemId, refreshFn) {
    container.addEventListener("click", async event => {
        const button = event.target.closest("button");
        if (!button) return;
        const allergyId = Number.parseInt(button.dataset.allergyId, 10);
        if (!Number.isInteger(allergyId)) return;
        try {
            await api(`/api/items/${itemId}/allergy/remove`, {
                method: "POST",
                body: JSON.stringify({allergyId})
            });
            showUndo("Allergy removed", async () => {
                await api(`/api/items/${itemId}/allergy/add`, {
                    method: "POST",
                    body: JSON.stringify({allergyId})
                });
                await refreshFn();
            });
            await refreshFn();
        } catch (err) {
            showToast(err.message || "Remove failed", "error");
        }
    });
}

function wireItemEditor(prefix, item, categories, allergies, refreshFn) {
    initColorPicker(`${prefix}-colour`);
    const categorySearch = document.getElementById(`${prefix}-category-search`);
    const categoryResults = document.getElementById(`${prefix}-category-results`);
    const saveButton = document.getElementById(`${prefix}-save`);
    const deleteButton = document.getElementById(`${prefix}-delete`);
    const currentCategories = document.getElementById(`${prefix}-current-categories`);
    const allergySearch = document.getElementById(`${prefix}-allergy-search`);
    const allergyResults = document.getElementById(`${prefix}-allergy-results`);
    const currentAllergies = document.getElementById(`${prefix}-current-allergies`);

    saveButton.addEventListener("click", () => {
        saveItemFromEditor(prefix, item.itemId, item, refreshFn);
    });
    if (deleteButton) {
        deleteButton.addEventListener("click", async () => {
            await deleteItem(item.itemId);
        });
    }

    let categoryTimer = null;
    categorySearch.addEventListener("input", () => {
        if (categoryTimer) clearTimeout(categoryTimer);
        categoryTimer = setTimeout(() => searchCategories(categorySearch.value, categoryResults, async entry => {
            if (!entry) return;
            if (categories?.some(cat => cat.categoryId === entry.id)) {
                showToast("Category already added");
                return;
            }
            try {
                await api(`/api/items/${item.itemId}/category/add`, {
                    method: "POST",
                    body: JSON.stringify({categoryId: entry.id})
                });
                showUndo("Category added", async () => {
                    await api(`/api/items/${item.itemId}/category/remove`, {
                        method: "POST",
                        body: JSON.stringify({categoryId: entry.id})
                    });
                    await refreshFn();
                });
                await refreshFn();
            } catch (err) {
                showToast(err.message || "Category add failed", "error");
            }
        }), 250);
    });

    if (currentCategories) {
        attachCategoryChipRemoval(currentCategories, item.itemId, refreshFn);
    }

    let allergyTimer = null;
    allergySearch.addEventListener("input", () => {
        if (allergyTimer) clearTimeout(allergyTimer);
        allergyTimer = setTimeout(() => searchAllergies(allergySearch.value, allergyResults, async entry => {
            if (!entry) return;
            if (allergies?.some(allergy => allergy.allergyId === entry.id)) {
                showToast("Allergy already added");
                return;
            }
            try {
                await api(`/api/items/${item.itemId}/allergy/add`, {
                    method: "POST",
                    body: JSON.stringify({allergyId: entry.id})
                });
                showUndo("Allergy added", async () => {
                    await api(`/api/items/${item.itemId}/allergy/remove`, {
                        method: "POST",
                        body: JSON.stringify({allergyId: entry.id})
                    });
                    await refreshFn();
                });
                await refreshFn();
            } catch (err) {
                showToast(err.message || "Allergy add failed", "error");
            }
        }), 250);
    });

    if (currentAllergies) {
        attachAllergyChipRemoval(currentAllergies, item.itemId, refreshFn);
    }
}

async function renderInlineItemEditor(container, itemId, categoryId = null) {
    container.innerHTML = `<div class="detail-empty">Loading item...</div>`;
    try {
        const data = await api(`/api/items/${itemId}`);
        if (categoryId != null && !data.categories?.some(cat => cat.categoryId === categoryId)) {
            await selectCategory(categoryId);
            return;
        }
        const rowLabel = container.closest("li")?.querySelector(".item-row > span");
        if (rowLabel) {
            rowLabel.innerHTML = `${escapeHtml(data.item.itemName ?? "")} <span class="muted">#${data.item.itemId}</span>`;
        }
        const prefix = `inline-${itemId}`;
        container.innerHTML = `
            ${buildItemEditorMarkup(data.item, data.categories || [], data.allergies || [], prefix)}
            <div class="actions" style="margin-top: 10px;">
                <button class="btn ghost small" type="button" data-action="close-inline">Close edit</button>
            </div>
        `;
        const refreshInline = async () => {
            if (!container.isConnected || container.style.display === "none") return;
            await renderInlineItemEditor(container, itemId, categoryId);
        };
        wireItemEditor(prefix, data.item, data.categories || [], data.allergies || [], refreshInline);
        const closeBtn = container.querySelector("[data-action=\"close-inline\"]");
        if (closeBtn) {
            closeBtn.addEventListener("click", event => {
                event.stopPropagation();
                container.style.display = "none";
                if (categoryId != null) {
                    const openSet = getCategoryOpenSet(categoryId);
                    openSet.delete(itemId);
                }
            });
        }

        attachAutoSave(container, async () => {
            await saveItemFromEditor(prefix, itemId, data.item, refreshInline);
        }, () => {
            if (!container.isConnected || container.style.display === "none") return false;
            return itemHasChanges(getItemEditorSnapshot(prefix), data.item);
        });
    } catch (err) {
        container.innerHTML = `<div class="detail-empty">Failed to load item.</div>`;
    }
}

function renderItemDetail(item, categories, allergies) {
    state.createMode.item = false;
    state.selectedCategoryId = null;
    state.currentItem = item;
    state.currentItemCategories = Array.isArray(categories)
        ? categories.map(cat => cat.categoryId)
        : [];

    itemDetail.innerHTML = buildItemEditorMarkup(item, categories, allergies || [], "item");
    const refreshMain = async () => {
        if (state.selectedItemId !== item.itemId) return;
        await refreshItemDetail(item.itemId, "main");
    };
    wireItemEditor("item", item, categories, allergies || [], refreshMain);

    attachAutoSave(itemDetail, async () => {
        await saveItemFromEditor("item", item.itemId, item, refreshMain);
    }, () => {
        if (state.selectedItemId !== item.itemId) return false;
        return itemHasChanges(getItemEditorSnapshot("item"), item);
    });
}
