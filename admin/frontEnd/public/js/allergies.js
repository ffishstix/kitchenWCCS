async function searchAllergiesManager() {
    const term = allergySearchInput.value.trim();
    const sort = allergySortSelect.value || "name";
    allergyResults.innerHTML = `<li class="muted">Searching...</li>`;
    try {
        const data = await api(`/api/allergies?search=${encodeURIComponent(term)}&limit=50&sort=${encodeURIComponent(sort)}`);
        state.allergies = data.allergies;
        if (!state.allergies.length) {
            allergyResults.innerHTML = `<li class="muted">No allergies found.</li>`;
            return;
        }
        allergyResults.innerHTML = state.allergies
            .map(allergy => `
                <li data-id="${allergy.allergyId}">
                    ${escapeHtml(allergy.allergyName)}
                    <span class="muted">#${allergy.allergyId}</span>
                </li>
            `)
            .join("");
    } catch (err) {
        allergyResults.innerHTML = `<li class="muted">Search failed.</li>`;
    }
}

async function createAllergy(useTemplate = null) {
    const fromTemplate = useTemplate === null ? state.createMode.allergy : useTemplate;
    const name = (fromTemplate
        ? getInputValueById("allergy-new-name", allergyCreateName)
        : allergyCreateName.value
    ).trim();
    if (!name) {
        showToast("Enter an allergy name", "error");
        return;
    }

    try {
        const data = await api("/api/allergies", {
            method: "POST",
            body: JSON.stringify({allergyName: name})
        });
        allergyCreateName.value = "";
        updateAllergyCreateButtons();
        await searchAllergiesManager();
        if (data.allergy?.allergyId) {
            const pending = [...state.pendingAllergyItems];
            state.pendingAllergyItems = [];
            if (pending.length) {
                const results = await Promise.allSettled(pending.map(item => api(`/api/items/${item.id}/allergy/add`, {
                    method: "POST",
                    body: JSON.stringify({allergyId: data.allergy.allergyId})
                })));
                const failures = results.filter(result => result.status === "rejected");
                if (failures.length) {
                    showToast("Some items failed to add", "error");
                }
            }
            selectAllergy(data.allergy.allergyId);
        } else if (state.createMode.allergy) {
            renderAllergyCreateTemplate();
        }
        showToast("Allergy added");
    } catch (err) {
        showToast(err.message || "Allergy create failed", "error");
    }
}

function isAllergyCreateReady() {
    const name = getInputValueById("allergy-new-name", allergyCreateName).trim();
    return Boolean(name);
}

function updateAllergyCreateButtons() {
    const ready = isAllergyCreateReady();
    allergyCreateBtn.disabled = !ready;
    const templateButton = document.getElementById("allergy-template-create");
    if (templateButton) templateButton.disabled = !ready;
}

function renderAllergyCreateTemplate() {
    state.createMode.allergy = true;
    state.selectedAllergyId = null;
    state.currentAllergy = null;
    clearActiveList(allergyResults);

    const nameValue = allergyCreateName.value.trim();
    state.pendingAllergyItems = [];

    allergyDetail.innerHTML = `
        <div class="form-grid">
            <div class="form-field">
                <label class="label">Allergy name</label>
                <input id="allergy-new-name" value="${escapeHtml(nameValue)}" placeholder="New allergy" />
            </div>
        </div>
        <div class="actions" style="margin-top: 14px;">
            <button class="btn primary" id="allergy-template-create">Create allergy</button>
        </div>
        <div style="margin-top: 16px;">
            <div class="label">Add items to allergy</div>
            <div class="form-grid" style="margin-top: 8px;">
                <div class="form-field">
                    <label class="label">Item search</label>
                    <input id="allergy-new-item-search" placeholder="Search by name" />
                    <ul class="list" id="allergy-new-item-results" style="max-height: 160px;"></ul>
                </div>
            </div>
            <div class="chips" id="allergy-new-item-chips" style="margin-top: 8px;"></div>
        </div>
    `;

    wireAllergyCreateTemplate();
}

function wireAllergyCreateTemplate() {
    const nameInput = document.getElementById("allergy-new-name");
    const createButton = document.getElementById("allergy-template-create");
    const itemSearch = document.getElementById("allergy-new-item-search");
    const itemResults = document.getElementById("allergy-new-item-results");
    const chips = document.getElementById("allergy-new-item-chips");

    if (nameInput) {
        nameInput.addEventListener("input", () => {
            if (allergyCreateName.value !== nameInput.value) {
                allergyCreateName.value = nameInput.value;
            }
            updateAllergyCreateButtons();
        });
    }

    if (createButton) {
        createButton.addEventListener("click", () => createAllergy(true));
    }

    if (itemSearch && itemResults) {
        let itemTimer = null;
        itemSearch.addEventListener("input", () => {
            if (itemTimer) clearTimeout(itemTimer);
            itemTimer = setTimeout(() => searchItemsForAssign(itemSearch.value, itemResults, (item) => {
                if (!item) return;
                if (state.pendingAllergyItems.some(entry => entry.id === item.id)) {
                    showToast("Item already added");
                    return;
                }
                state.pendingAllergyItems.push({id: item.id, name: item.name || `Item #${item.id}`});
                renderPendingItemChips(chips, state.pendingAllergyItems, "No items selected yet.");
            }), 250);
        });
    }

    if (chips) {
        renderPendingItemChips(chips, state.pendingAllergyItems, "No items selected yet.");
        chips.addEventListener("click", event => {
            const button = event.target.closest("button");
            if (!button) return;
            const itemId = Number.parseInt(button.dataset.id, 10);
            if (!Number.isInteger(itemId)) return;
            state.pendingAllergyItems = state.pendingAllergyItems.filter(item => item.id !== itemId);
            renderPendingItemChips(chips, state.pendingAllergyItems, "No items selected yet.");
        });
    }

    updateAllergyCreateButtons();
}

function syncAllergyCreateFromLeft() {
    if (!state.createMode.allergy) {
        updateAllergyCreateButtons();
        return;
    }
    const nameInput = document.getElementById("allergy-new-name");
    if (nameInput && nameInput.value !== allergyCreateName.value) {
        nameInput.value = allergyCreateName.value;
    }
    updateAllergyCreateButtons();
}

function activateAllergyCreateTemplate() {
    if (!state.createMode.allergy) {
        renderAllergyCreateTemplate();
        return;
    }
    syncAllergyCreateFromLeft();
}

async function selectAllergy(allergyId) {
    state.createMode.allergy = false;
    state.selectedAllergyId = allergyId;
    for (const li of allergyResults.querySelectorAll("li")) {
        li.classList.toggle("active", Number(li.dataset.id) === allergyId);
    }

    allergyDetail.innerHTML = `<div class="detail-empty">Loading allergy...</div>`;

    try {
        const [data, itemsData] = await Promise.all([
            api(`/api/allergies/${allergyId}`),
            api(`/api/allergies/${allergyId}/items`)
        ]);
        renderAllergyDetail(data.allergy, itemsData.items || []);
    } catch (err) {
        allergyDetail.innerHTML = `<div class="detail-empty">Failed to load allergy.</div>`;
    }
}

function renderAllergyDetail(allergy, items = []) {
    state.createMode.allergy = false;
    state.currentAllergy = allergy;
    allergyDetail.innerHTML = `
        <div class="form-grid">
            <div class="form-field">
                <label class="label">Allergy name</label>
                <input id="allergy-name" value="${escapeHtml(allergy.allergyName ?? "")}" />
            </div>
        </div>
        <div class="actions" style="margin-top: 14px;">
            <button class="btn primary" id="save-allergy">Save allergy changes</button>
            <button class="btn danger" id="delete-allergy">Delete allergy</button>
        </div>
        <div style="margin-top: 16px;">
            <div class="label">Add item to allergy</div>
            <div class="form-grid" style="margin-top: 8px;">
                <div class="form-field">
                    <label class="label">Item search</label>
                    <input id="allergy-item-search" placeholder="Search by name" />
                    <ul class="list" id="allergy-item-results" style="max-height: 160px;"></ul>
                </div>
            </div>
        </div>
        <div style="margin-top: 16px;">
            <div class="label">Items with this allergy</div>
            <ul class="list removable" id="allergy-items" style="margin-top: 8px;">
                ${items.length
        ? items.map(item => `
                        <li data-id="${item.itemId}">
                            <div class="item-row">
                                <span>${escapeHtml(item.itemName)} <span class="muted">#${item.itemId}</span></span>
                                <button class="remove-btn" type="button" data-item-id="${item.itemId}" aria-label="Remove">&times;</button>
                            </div>
                        </li>
                    `).join("")
        : `<li class="muted">No items for this allergy.</li>`
    }
            </ul>
        </div>
    `;

    document.getElementById("save-allergy").addEventListener("click", () => {
        saveAllergyChanges(allergy.allergyId);
    });
    document.getElementById("delete-allergy").addEventListener("click", async () => {
        await deleteAllergy(allergy.allergyId);
    });

    const allergyItemSearch = document.getElementById("allergy-item-search");
    const allergyItemResults = document.getElementById("allergy-item-results");
    const pendingAdd = new Set();

    if (allergyItemSearch && allergyItemResults) {
        let itemTimer = null;
        allergyItemSearch.addEventListener("input", () => {
            if (itemTimer) clearTimeout(itemTimer);
            itemTimer = setTimeout(() => searchItemsForAssign(allergyItemSearch.value, allergyItemResults, async (item) => {
                if (!item || pendingAdd.has(item.id)) return;
                pendingAdd.add(item.id);
                try {
                    await api(`/api/items/${item.id}/allergy/add`, {
                        method: "POST",
                        body: JSON.stringify({allergyId: allergy.allergyId})
                    });
                    showUndo("Item added", async () => {
                        await api(`/api/items/${item.id}/allergy/remove`, {
                            method: "POST",
                            body: JSON.stringify({allergyId: allergy.allergyId})
                        });
                        const restored = await api(`/api/allergies/${allergy.allergyId}/items`);
                        renderAllergyDetail(allergy, restored.items || []);
                    });
                    const refreshed = await api(`/api/allergies/${allergy.allergyId}/items`);
                    renderAllergyDetail(allergy, refreshed.items || []);
                } catch (err) {
                    showToast(err.message || "Add failed", "error");
                } finally {
                    pendingAdd.delete(item.id);
                }
            }), 250);
        });
    }

    const itemsList = document.getElementById("allergy-items");
    if (itemsList) {
        itemsList.addEventListener("click", async event => {
            const button = event.target.closest(".remove-btn");
            if (!button) return;
            const itemId = Number.parseInt(button.dataset.itemId, 10);
            if (!Number.isInteger(itemId)) return;
            try {
                await api(`/api/items/${itemId}/allergy/remove`, {
                    method: "POST",
                    body: JSON.stringify({allergyId: allergy.allergyId})
                });
                showUndo("Allergy removed", async () => {
                    await api(`/api/items/${itemId}/allergy/add`, {
                        method: "POST",
                        body: JSON.stringify({allergyId: allergy.allergyId})
                    });
                    const restored = await api(`/api/allergies/${allergy.allergyId}/items`);
                    renderAllergyDetail(allergy, restored.items || []);
                });
                const refreshed = await api(`/api/allergies/${allergy.allergyId}/items`);
                renderAllergyDetail(allergy, refreshed.items || []);
            } catch (err) {
                showToast(err.message || "Remove failed", "error");
            }
        });
    }

    attachAutoSave(allergyDetail, async () => {
        await saveAllergyChanges(allergy.allergyId);
    }, () => {
        if (state.selectedAllergyId !== allergy.allergyId) return false;
        return allergyHasChanges(getAllergyEditorName(), state.currentAllergy);
    });
}

function getAllergyEditorName() {
    const nameInput = document.getElementById("allergy-name");
    if (!nameInput) return null;
    return nameInput.value.trim();
}

function allergyHasChanges(name, currentAllergy) {
    if (name == null || !currentAllergy) return false;
    const currentName = String(currentAllergy.allergyName ?? "").trim();
    return name !== currentName;
}

async function saveAllergyChanges(allergyId) {
    const name = getAllergyEditorName();
    if (name == null) return;
    const previous = state.currentAllergy ? {...state.currentAllergy} : null;
    if (!allergyHasChanges(name, state.currentAllergy)) return;

    try {
        await api(`/api/allergies/${allergyId}`, {
            method: "PATCH",
            body: JSON.stringify({allergyName: name})
        });
        showUndo("Allergy updated", async () => {
            if (!previous) return;
            await api(`/api/allergies/${allergyId}`, {
                method: "PATCH",
                body: JSON.stringify({allergyName: previous.allergyName ?? ""})
            });
            if (state.selectedAllergyId !== allergyId) return;
            const restored = await api(`/api/allergies/${allergyId}`);
            const items = await api(`/api/allergies/${allergyId}/items`);
            renderAllergyDetail(restored.allergy, items.items || []);
        });
        await searchAllergiesManager();
        if (state.selectedAllergyId !== allergyId) return;
        const updated = await api(`/api/allergies/${allergyId}`);
        const items = await api(`/api/allergies/${allergyId}/items`);
        renderAllergyDetail(updated.allergy, items.items || []);
    } catch (err) {
        showToast(err.message || "Update failed", "error");
    }
}

async function deleteAllergy(allergyId) {
    if (!Number.isInteger(allergyId)) return;
    if (!confirm(`Delete allergy #${allergyId}?`)) return;

    try {
        await api(`/api/allergies/${allergyId}`, {method: "DELETE"});
        state.selectedAllergyId = null;
        state.currentAllergy = null;
        allergyDetail.innerHTML = `<div class="detail-empty">Select an allergy to edit.</div>`;
        await searchAllergiesManager();
        showToast("Allergy deleted");
    } catch (err) {
        showToast(err.message || "Delete failed", "error");
    }
}
