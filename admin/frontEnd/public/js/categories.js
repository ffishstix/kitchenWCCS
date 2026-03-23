// Query categories by search term and render the list.
async function searchCategoriesManager() {
    const term = categorySearchInput.value.trim();
    categoryResults.innerHTML = `<li class="muted">Searching...</li>`;
    try {
        const data = await api(`/api/categories?search=${encodeURIComponent(term)}&limit=50`);
        state.categories = data.categories;
        if (!state.categories.length) {
            categoryResults.innerHTML = `<li class="muted">No categories found.</li>`;
            return;
        }
        categoryResults.innerHTML = state.categories
            .map(category => `
                <li data-id="${category.categoryId}">
                    ${escapeHtml(category.catName)}
                    <span class="muted">#${category.categoryId}</span>
                </li>
            `)
            .join("");
    } catch (err) {
        categoryResults.innerHTML = `<li class="muted">Search failed.</li>`;
    }
}

// Create a category and apply any pending item assignments.
async function createCategory(useTemplate = null) {
    const fromTemplate = useTemplate === null ? state.createMode.category : useTemplate;
    const name = (fromTemplate
        ? getInputValueById("category-new-name", categoryCreateName)
        : categoryCreateName.value
    ).trim();
    const chosenColour = (fromTemplate
        ? getInputValueById("category-new-colour", categoryCreateColour)
        : getInputValueById("category-create-colour", categoryCreateColour)
    ).trim();
    const extraCatInfo = fromTemplate ? getInputValueById("category-new-extra").trim() : "";

    if (!name) {
        showToast("Enter a category name", "error");
        return;
    }
    if (chosenColour && !isValidColorName(chosenColour)) {
        showToast("Choose a valid C# Color", "error");
        return;
    }

    try {
        const data = await api("/api/categories", {
            method: "POST",
            body: JSON.stringify({catName: name, chosenColour, extraCatInfo})
        });
        categoryCreateName.value = "";
        if (categoryCreateColour) categoryCreateColour.value = "";
        resetColorPicker("category-create-colour");
        updateCategoryCreateButtons();
        await searchCategoriesManager();
        if (data.category?.categoryId) {
            const pending = [...state.pendingCategoryItems];
            state.pendingCategoryItems = [];
            if (pending.length) {
                const results = await Promise.allSettled(pending.map(item => api(`/api/items/${item.id}/category/add`, {
                    method: "POST",
                    body: JSON.stringify({categoryId: data.category.categoryId})
                })));
                const failures = results.filter(result => result.status === "rejected");
                if (failures.length) {
                    showToast("Some items failed to add", "error");
                }
            }
            selectCategory(data.category.categoryId);
        } else if (state.createMode.category) {
            renderCategoryCreateTemplate();
        }
        showToast("Category added");
    } catch (err) {
        showToast(err.message || "Category create failed", "error");
    }
}

function isCategoryCreateReady() {
    const name = getInputValueById("category-new-name", categoryCreateName).trim();
    return Boolean(name);
}

function updateCategoryCreateButtons() {
    const ready = isCategoryCreateReady();
    categoryCreateBtn.disabled = !ready;
    const templateButton = document.getElementById("category-template-create");
    if (templateButton) templateButton.disabled = !ready;
}

// Render the new-category form and wire its controls.
function renderCategoryCreateTemplate() {
    state.createMode.category = true;
    state.selectedCategoryId = null;
    state.currentCategory = null;
    clearActiveList(categoryResults);

    const nameValue = categoryCreateName.value.trim();
    const colourValue = categoryCreateColour.value.trim();
    state.pendingCategoryItems = [];

    categoryDetail.innerHTML = `
        <div class="form-grid">
            <div class="form-field">
                <label class="label">Category name</label>
                <input id="category-new-name" value="${escapeHtml(nameValue)}" placeholder="New category" />
            </div>
            <div class="form-field">
                <label class="label">Colour</label>
                ${buildColorPicker("category-new-colour", colourValue)}
            </div>
            <div class="form-field" style="grid-column: 1 / -1;">
                <label class="label">Extra category info</label>
                <textarea id="category-new-extra" placeholder="Optional notes"></textarea>
            </div>
        </div>
        <div class="actions" style="margin-top: 14px;">
            <button class="btn primary" id="category-template-create">Create category</button>
        </div>
        <div style="margin-top: 16px;">
            <div class="label">Add items to category</div>
            <div class="form-grid" style="margin-top: 8px;">
                <div class="form-field">
                    <label class="label">Item search</label>
                    <input id="category-new-item-search" placeholder="Search by name" />
                    <ul class="list" id="category-new-item-results" style="max-height: 160px;"></ul>
                </div>
            </div>
            <div class="chips" id="category-new-item-chips" style="margin-top: 8px;"></div>
        </div>
    `;

    initColorPicker("category-new-colour");
    wireCategoryCreateTemplate();
}

// Bind handlers for the category creation template.
function wireCategoryCreateTemplate() {
    const nameInput = document.getElementById("category-new-name");
    const colourInput = document.getElementById("category-new-colour");
    const createButton = document.getElementById("category-template-create");
    const itemSearch = document.getElementById("category-new-item-search");
    const itemResults = document.getElementById("category-new-item-results");
    const chips = document.getElementById("category-new-item-chips");

    if (nameInput) {
        nameInput.addEventListener("input", () => {
            if (categoryCreateName.value !== nameInput.value) {
                categoryCreateName.value = nameInput.value;
            }
            updateCategoryCreateButtons();
        });
    }

    if (colourInput) {
        colourInput.addEventListener("input", () => {
            if (categoryCreateColour.value !== colourInput.value) {
                categoryCreateColour.value = colourInput.value;
            }
        });
    }

    if (createButton) {
        createButton.addEventListener("click", () => createCategory(true));
    }

    if (itemSearch && itemResults) {
        let itemTimer = null;
        itemSearch.addEventListener("input", () => {
            if (itemTimer) clearTimeout(itemTimer);
            itemTimer = setTimeout(() => searchItemsForAssign(itemSearch.value, itemResults, (item) => {
                if (!item) return;
                if (state.pendingCategoryItems.some(entry => entry.id === item.id)) {
                    showToast("Item already added");
                    return;
                }
                state.pendingCategoryItems.push({id: item.id, name: item.name || `Item #${item.id}`});
                renderPendingItemChips(chips, state.pendingCategoryItems, "No items selected yet.");
            }), 250);
        });
    }

    if (chips) {
        renderPendingItemChips(chips, state.pendingCategoryItems, "No items selected yet.");
        chips.addEventListener("click", event => {
            const button = event.target.closest("button");
            if (!button) return;
            const itemId = Number.parseInt(button.dataset.id, 10);
            if (!Number.isInteger(itemId)) return;
            state.pendingCategoryItems = state.pendingCategoryItems.filter(item => item.id !== itemId);
            renderPendingItemChips(chips, state.pendingCategoryItems, "No items selected yet.");
        });
    }

    updateCategoryCreateButtons();
}

function syncCategoryCreateFromLeft() {
    if (!state.createMode.category) {
        updateCategoryCreateButtons();
        return;
    }
    const nameInput = document.getElementById("category-new-name");
    if (nameInput && nameInput.value !== categoryCreateName.value) {
        nameInput.value = categoryCreateName.value;
    }
    updateCategoryCreateButtons();
}

function activateCategoryCreateTemplate() {
    if (!state.createMode.category) {
        renderCategoryCreateTemplate();
        return;
    }
    syncCategoryCreateFromLeft();
}

// Load a category and render its detail view.
async function selectCategory(categoryId) {
    state.createMode.category = false;
    state.selectedCategoryId = categoryId;
    for (const li of categoryResults.querySelectorAll("li")) {
        li.classList.toggle("active", Number(li.dataset.id) === categoryId);
    }

    categoryDetail.innerHTML = `<div class="detail-empty">Loading category...</div>`;

    try {
        const [data, itemsData] = await Promise.all([
            api(`/api/categories/${categoryId}`),
            api(`/api/categories/${categoryId}/items`)
        ]);
        renderCategoryDetail(data.category, itemsData.items || []);
    } catch (err) {
        categoryDetail.innerHTML = `<div class="detail-empty">Failed to load category.</div>`;
    }
}

// Render the category editor with its item assignments.
function renderCategoryDetail(category, items = []) {
    state.createMode.category = false;
    state.currentCategory = category;
    const openSet = getCategoryOpenSet(category.categoryId);
    const currentIds = new Set(items.map(item => item.itemId));
    for (const id of Array.from(openSet)) {
        if (!currentIds.has(id)) openSet.delete(id);
    }
    if (openSet.size > 1) {
        const first = openSet.values().next().value;
        openSet.clear();
        if (first != null) openSet.add(first);
    }
    categoryDetail.innerHTML = `
        <div class="form-grid">
            <div class="form-field">
                <label class="label">Name</label>
                <input id="category-name" value="${escapeHtml(category.catName ?? "")}" />
            </div>
            <div class="form-field">
                <label class="label">Colour</label>
                ${buildColorPicker("category-colour", category.chosenColour ?? "")}
            </div>
            <div class="form-field" style="grid-column: 1 / -1;">
                <label class="label">Extra category info</label>
                <textarea id="category-extra-cat">${escapeHtml(category.extraCatInfo ?? "")}</textarea>
            </div>
        </div>
        <div class="actions" style="margin-top: 14px;">
            <button class="btn primary" id="save-category">Save category changes</button>
            <button class="btn danger" id="delete-category">Delete category</button>
        </div>
        <div style="margin-top: 16px;">
            <div class="label">Add item to category</div>
            <div class="form-grid" style="margin-top: 8px;">
                <div class="form-field">
                    <label class="label">Item search</label>
                    <input id="category-item-search" placeholder="Search by name" />
                    <ul class="list" id="category-item-results" style="max-height: 160px;"></ul>
                </div>
            </div>
        </div>
        <div style="margin-top: 16px;">
            <div class="label">Items in category</div>
            <ul class="list removable" id="category-items" style="margin-top: 8px;">
                ${items.length
        ? items.map(item => `
                        <li class="category-item" data-id="${item.itemId}">
                            <div class="item-row">
                                <span>${escapeHtml(item.itemName)} <span class="muted">#${item.itemId}</span></span>
                                <div class="item-actions">
                                    <button class="remove-btn" type="button" data-item-id="${item.itemId}" aria-label="Remove">&times;</button>
                                </div>
                            </div>
                            <div class="item-editor" id="category-item-editor-${item.itemId}" style="display: none;"></div>
                        </li>
                    `).join("")
        : `<li class="muted">No items in this category.</li>`
    }
            </ul>
        </div>
    `;

    initColorPicker("category-colour");
    document.getElementById("save-category").addEventListener("click", () => {
        saveCategoryChanges(category.categoryId);
    });
    document.getElementById("delete-category").addEventListener("click", async () => {
        await deleteCategory(category.categoryId);
    });

    const categoryItemSearch = document.getElementById("category-item-search");
    const categoryItemResults = document.getElementById("category-item-results");
    const pendingAdd = new Set();

    if (categoryItemSearch && categoryItemResults) {
        let itemTimer = null;
        categoryItemSearch.addEventListener("input", () => {
            if (itemTimer) clearTimeout(itemTimer);
            itemTimer = setTimeout(() => searchItemsForAssign(categoryItemSearch.value, categoryItemResults, async (item) => {
                if (!item || pendingAdd.has(item.id)) return;
                pendingAdd.add(item.id);
                try {
                    await api(`/api/items/${item.id}/category/add`, {
                        method: "POST",
                        body: JSON.stringify({categoryId: category.categoryId})
                    });
                    showUndo("Item added", async () => {
                        await api(`/api/items/${item.id}/category/remove`, {
                            method: "POST",
                            body: JSON.stringify({categoryId: category.categoryId})
                        });
                        const restored = await api(`/api/categories/${category.categoryId}/items`);
                        renderCategoryDetail(category, restored.items || []);
                    });
                    const refreshed = await api(`/api/categories/${category.categoryId}/items`);
                    renderCategoryDetail(category, refreshed.items || []);
                } catch (err) {
                    showToast(err.message || "Add failed", "error");
                } finally {
                    pendingAdd.delete(item.id);
                }
            }), 250);
        });
    }

    const itemsList = document.getElementById("category-items");
    if (itemsList) {
        itemsList.addEventListener("click", async event => {
            if (event.target.closest(".item-editor")) return;

            const button = event.target.closest(".remove-btn");
            if (button) {
                const itemId = Number.parseInt(button.dataset.itemId, 10);
                if (!Number.isInteger(itemId)) return;
                openSet.delete(itemId);
                try {
                    await api(`/api/items/${itemId}/category/remove`, {
                        method: "POST",
                        body: JSON.stringify({categoryId: category.categoryId})
                    });
                    showUndo("Item removed", async () => {
                        await api(`/api/items/${itemId}/category/add`, {
                            method: "POST",
                            body: JSON.stringify({categoryId: category.categoryId})
                        });
                        const restored = await api(`/api/categories/${category.categoryId}/items`);
                        renderCategoryDetail(category, restored.items || []);
                    });
                    const refreshed = await api(`/api/categories/${category.categoryId}/items`);
                    renderCategoryDetail(category, refreshed.items || []);
                } catch (err) {
                    showToast(err.message || "Remove failed", "error");
                }
                return;
            }

            const row = event.target.closest(".item-row");
            if (!row) return;
            const itemRow = row.closest("li");
            if (!itemRow) return;
            const itemId = Number.parseInt(itemRow.dataset.id, 10);
            if (!Number.isInteger(itemId)) return;
            const editor = itemRow.querySelector(".item-editor");
            if (!editor) return;
            const isOpen = editor.style.display === "block";
            if (isOpen) {
                editor.style.display = "none";
                openSet.delete(itemId);
                return;
            }

            for (const openId of Array.from(openSet)) {
                if (openId === itemId) continue;
                const openEditor = document.getElementById(`category-item-editor-${openId}`);
                if (openEditor) openEditor.style.display = "none";
                openSet.delete(openId);
            }

            editor.style.display = "block";
            openSet.add(itemId);
            await renderInlineItemEditor(editor, itemId, category.categoryId);
        });

        for (const itemId of openSet) {
            const editor = document.getElementById(`category-item-editor-${itemId}`);
            if (editor) {
                editor.style.display = "block";
                renderInlineItemEditor(editor, itemId, category.categoryId);
            }
        }
    }

    attachAutoSave(categoryDetail, async () => {
        await saveCategoryChanges(category.categoryId);
    }, () => {
        if (state.selectedCategoryId !== category.categoryId) return false;
        const payload = getCategoryEditorPayload();
        return categoryHasChanges(payload, state.currentCategory);
    });
}

function getCategoryEditorPayload() {
    const nameInput = document.getElementById("category-name");
    const colourInput = document.getElementById("category-colour");
    const extraInput = document.getElementById("category-extra-cat");
    if (!nameInput || !colourInput || !extraInput) return null;
    return {
        catName: nameInput.value.trim(),
        chosenColour: colourInput.value.trim(),
        extraCatInfo: extraInput.value.trim()
    };
}

function categoryHasChanges(payload, currentCategory) {
    if (!payload || !currentCategory) return false;
    const currentName = String(currentCategory.catName ?? "").trim();
    const currentColour = String(currentCategory.chosenColour ?? "").trim();
    const currentExtra = String(currentCategory.extraCatInfo ?? "").trim();
    return payload.catName !== currentName
        || payload.chosenColour !== currentColour
        || payload.extraCatInfo !== currentExtra;
}

// Persist category edits and refresh the detail view.
async function saveCategoryChanges(categoryId) {
    const payload = getCategoryEditorPayload();
    if (!payload) return;

    const chosenColour = payload.chosenColour;
    if (chosenColour && !isValidColorName(chosenColour)) {
        showToast("Choose a valid C# Color", "error");
        return;
    }

    const previous = state.currentCategory ? {...state.currentCategory} : null;
    if (!categoryHasChanges(payload, state.currentCategory)) return;

    try {
        await api(`/api/categories/${categoryId}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        });
        showUndo("Category updated", async () => {
            if (!previous) return;
            await api(`/api/categories/${categoryId}`, {
                method: "PATCH",
                body: JSON.stringify({
                    catName: previous.catName ?? "",
                    chosenColour: previous.chosenColour ?? "",
                    extraCatInfo: previous.extraCatInfo ?? ""
                })
            });
            if (state.selectedCategoryId !== categoryId) return;
            const restored = await api(`/api/categories/${categoryId}`);
            const items = await api(`/api/categories/${categoryId}/items`);
            renderCategoryDetail(restored.category, items.items || []);
        });
        await searchCategoriesManager();
        if (state.selectedCategoryId !== categoryId) return;
        const updated = await api(`/api/categories/${categoryId}`);
        const items = await api(`/api/categories/${categoryId}/items`);
        renderCategoryDetail(updated.category, items.items || []);
    } catch (err) {
        showToast(err.message || "Update failed", "error");
    }
}

async function deleteCategory(categoryId) {
    if (!Number.isInteger(categoryId)) return;
    if (!confirm(`Delete category #${categoryId}?`)) return;

    try {
        await api(`/api/categories/${categoryId}`, {method: "DELETE"});
        state.selectedCategoryId = null;
        state.currentCategory = null;
        categoryDetail.innerHTML = `<div class="detail-empty">Select a category to edit.</div>`;
        await searchCategoriesManager();
        showToast("Category deleted");
    } catch (err) {
        showToast(err.message || "Delete failed", "error");
    }
}
