async function searchStaff() {
    const term = staffSearchInput.value.trim();
    staffResults.innerHTML = `<li class="muted">Searching...</li>`;
    try {
        const data = await api(`/api/staff?search=${encodeURIComponent(term)}&limit=50`);
        state.staff = data.staff;
        if (!state.staff.length) {
            staffResults.innerHTML = `<li class="muted">No staff found.</li>`;
            return;
        }
        staffResults.innerHTML = state.staff
            .map(member => `
                <li data-id="${member.id}">
                    ${escapeHtml(member.name)}
                    <span class="muted">#${member.id}</span>
                </li>
            `)
            .join("");
    } catch (err) {
        staffResults.innerHTML = `<li class="muted">Search failed.</li>`;
    }
}

const ACCESS_FIELDS = [
    {key: "canSendThroughItems", label: "Send through items", id: "send"},
    {key: "canDelete", label: "Delete", id: "delete"},
    {key: "canNoSale", label: "No sale", id: "nosale"},
    {key: "canViewTables", label: "View tables", id: "tables"}
];

function buildAccessControls(prefix, values = {}) {
    return `
        <div class="access-grid">
            ${ACCESS_FIELDS.map(field => `
                <label class="access-option">
                    <input type="checkbox" id="${prefix}-${field.id}" ${values[field.key] ? "checked" : ""} />
                    <span>${field.label}</span>
                </label>
            `).join("")}
        </div>
    `;
}

function defaultAccessValues() {
    return {
        canSendThroughItems: false,
        canDelete: false,
        canNoSale: false,
        canViewTables: false
    };
}

function normalizeAccessValues(level) {
    return {
        canSendThroughItems: Number(level?.canSendThroughItems) === 1,
        canDelete: Number(level?.canDelete) === 1,
        canNoSale: Number(level?.canNoSale) === 1,
        canViewTables: Number(level?.canViewTables) === 1
    };
}

function getAccessValuesForLevel(accessLevel) {
    const level = state.accessLevels.find(item => String(item.accessLevel) === String(accessLevel));
    return level ? normalizeAccessValues(level) : null;
}

function readAccessValues(prefix, fallback = null) {
    const values = {};
    let found = false;
    ACCESS_FIELDS.forEach(field => {
        const input = document.getElementById(`${prefix}-${field.id}`);
        if (!input) return;
        values[field.key] = Boolean(input.checked);
        found = true;
    });
    return found ? values : fallback;
}

function setAccessValues(prefix, values) {
    if (!values) return;
    ACCESS_FIELDS.forEach(field => {
        const input = document.getElementById(`${prefix}-${field.id}`);
        if (input) {
            input.checked = Boolean(values[field.key]);
        }
    });
}

function ensureStaffAccessDraft() {
    if (state.staffAccessDraft) return;
    if (state.accessLevels.length) {
        state.staffAccessDraft = normalizeAccessValues(state.accessLevels[0]);
        return;
    }
    state.staffAccessDraft = defaultAccessValues();
}

function syncStaffCreateAccessUI() {
    ensureStaffAccessDraft();
    setAccessValues("staff-create", state.staffAccessDraft);
    if (state.createMode.staff) {
        setAccessValues("staff-new", state.staffAccessDraft);
    }
}

function wireAccessInputs(prefix, onChange) {
    ACCESS_FIELDS.forEach(field => {
        const input = document.getElementById(`${prefix}-${field.id}`);
        if (!input) return;
        input.addEventListener("change", () => {
            const values = readAccessValues(prefix, defaultAccessValues());
            onChange(values);
        });
    });
}

function renderStaffCreateOptions() {
    ensureStaffAccessDraft();
    syncStaffCreateAccessUI();
    updateStaffCreateButtons();
}

async function createStaff(useTemplate = null) {
    const fromTemplate = useTemplate === null ? state.createMode.staff : useTemplate;
    ensureStaffAccessDraft();
    const staffIdValue = (fromTemplate
        ? getInputValueById("staff-new-id", staffCreateId)
        : staffCreateId.value
    ).trim();
    const staffId = Number.parseInt(staffIdValue, 10);
    const name = (fromTemplate
        ? getInputValueById("staff-new-name", staffCreateName)
        : staffCreateName.value
    ).trim();
    const accessValues = fromTemplate
        ? readAccessValues("staff-new", state.staffAccessDraft)
        : readAccessValues("staff-create", state.staffAccessDraft);

    if (!Number.isInteger(staffId)) {
        showToast("Enter a staff ID", "error");
        return;
    }
    if (!name) {
        showToast("Enter a staff name", "error");
        return;
    }
    if (!accessValues) {
        showToast("Set access permissions", "error");
        return;
    }

    try {
        state.staffAccessDraft = accessValues;
        const data = await api("/api/staff", {
            method: "POST",
            body: JSON.stringify({staffId, name, ...accessValues})
        });
        staffCreateId.value = "";
        staffCreateName.value = "";
        updateStaffCreateButtons();
        await loadAccessLevels();
        await searchStaff();
        if (data.staff?.id) {
            selectStaff(data.staff.id);
        } else if (state.createMode.staff) {
            renderStaffCreateTemplate();
        }
        showToast("Staff added");
    } catch (err) {
        showToast(err.message || "Staff create failed", "error");
    }
}

function isStaffCreateReady() {
    const staffIdValue = getInputValueById("staff-new-id", staffCreateId).trim();
    const staffId = Number.parseInt(staffIdValue, 10);
    const name = getInputValueById("staff-new-name", staffCreateName).trim();
    return Number.isInteger(staffId) && Boolean(name);
}

function updateStaffCreateButtons() {
    const ready = isStaffCreateReady();
    staffCreateBtn.disabled = !ready;
    const templateButton = document.getElementById("staff-template-create");
    if (templateButton) templateButton.disabled = !ready;
}

function renderStaffCreateTemplate() {
    state.createMode.staff = true;
    state.selectedStaffId = null;
    clearActiveList(staffResults);

    ensureStaffAccessDraft();
    const nameValue = staffCreateName.value.trim();
    const idValue = staffCreateId.value.trim();

    staffDetail.innerHTML = `
        <div class="form-grid">
            <div class="form-field">
                <label class="label">Staff ID</label>
                <input id="staff-new-id" value="${escapeHtml(idValue)}" placeholder="Required ID" />
            </div>
            <div class="form-field">
                <label class="label">Name</label>
                <input id="staff-new-name" value="${escapeHtml(nameValue)}" placeholder="New staff name" />
            </div>
            <div class="form-field">
                <label class="label">Access</label>
                ${buildAccessControls("staff-new", state.staffAccessDraft)}
            </div>
        </div>
        <div class="actions" style="margin-top: 14px;">
            <button class="btn primary" id="staff-template-create">Create staff</button>
        </div>
    `;

    wireStaffCreateTemplate();
}

function wireStaffCreateTemplate() {
    const idInput = document.getElementById("staff-new-id");
    const nameInput = document.getElementById("staff-new-name");
    const createButton = document.getElementById("staff-template-create");

    if (idInput) {
        idInput.addEventListener("input", () => {
            if (staffCreateId.value !== idInput.value) {
                staffCreateId.value = idInput.value;
            }
            updateStaffCreateButtons();
        });
    }

    if (nameInput) {
        nameInput.addEventListener("input", () => {
            if (staffCreateName.value !== nameInput.value) {
                staffCreateName.value = nameInput.value;
            }
            updateStaffCreateButtons();
        });
    }

    wireAccessInputs("staff-new", values => {
        state.staffAccessDraft = values;
        setAccessValues("staff-create", values);
        updateStaffCreateButtons();
    });

    if (createButton) {
        createButton.addEventListener("click", () => createStaff(true));
    }

    updateStaffCreateButtons();
}

function syncStaffCreateFromLeft() {
    const accessValues = readAccessValues("staff-create", state.staffAccessDraft);
    if (accessValues) {
        state.staffAccessDraft = accessValues;
    }
    if (!state.createMode.staff) {
        updateStaffCreateButtons();
        return;
    }
    const idInput = document.getElementById("staff-new-id");
    const nameInput = document.getElementById("staff-new-name");
    if (idInput && idInput.value !== staffCreateId.value) {
        idInput.value = staffCreateId.value;
    }
    if (nameInput && nameInput.value !== staffCreateName.value) {
        nameInput.value = staffCreateName.value;
    }
    setAccessValues("staff-new", state.staffAccessDraft);
    updateStaffCreateButtons();
}

function activateStaffCreateTemplate() {
    if (!state.createMode.staff) {
        renderStaffCreateTemplate();
        return;
    }
    syncStaffCreateFromLeft();
}

async function selectStaff(staffId) {
    state.createMode.staff = false;
    state.selectedStaffId = staffId;
    for (const li of staffResults.querySelectorAll("li")) {
        li.classList.toggle("active", Number(li.dataset.id) === staffId);
    }

    const member = state.staff.find(item => item.id === staffId);
    if (!member) return;

    renderStaffDetail(member);
}

function renderStaffDetail(member) {
    state.createMode.staff = false;
    const accessValues = getAccessValuesForLevel(member.accessLevel) || defaultAccessValues();
    const previousAccess = {...accessValues};

    staffDetail.innerHTML = `
        <div class="form-grid">
            <div class="form-field">
                <label class="label">Name</label>
                <input id="staff-name" value="${escapeHtml(member.name ?? "")}" />
            </div>
            <div class="form-field">
                <label class="label">Staff ID</label>
                <input id="staff-id" value="${member.id}" />
            </div>
            <div class="form-field">
                <label class="label">Access</label>
                ${buildAccessControls("staff-access", accessValues)}
            </div>
        </div>
        <div class="actions" style="margin-top: 14px;">
            <button class="btn primary" id="save-staff">Save staff details</button>
            <button class="btn secondary" id="save-access">Update access</button>
            <button class="btn danger" id="delete-staff">Delete staff</button>
        </div>
    `;

    document.getElementById("save-staff").addEventListener("click", async () => {
        const nameInput = document.getElementById("staff-name");
        const idInput = document.getElementById("staff-id");
        const newName = nameInput ? nameInput.value.trim() : "";
        const newIdValue = idInput ? idInput.value.trim() : "";
        const newId = Number.parseInt(newIdValue, 10);
        const previous = {id: member.id, name: member.name ?? ""};
        if (!newName) {
            showToast("Enter a staff name", "error");
            return;
        }
        if (!Number.isInteger(newId)) {
            showToast("Enter a valid staff ID", "error");
            return;
        }
        if (newId === previous.id && newName === previous.name) {
            showToast("No changes to save");
            return;
        }
        try {
            await api(`/api/staff/${previous.id}`, {
                method: "PATCH",
                body: JSON.stringify({staffId: newId, name: newName})
            });
            const undoId = newId;
            showUndo("Staff updated", async () => {
                await api(`/api/staff/${undoId}`, {
                    method: "PATCH",
                    body: JSON.stringify({staffId: previous.id, name: previous.name})
                });
                await searchStaff();
                await selectStaff(previous.id);
            });
            await searchStaff();
            await selectStaff(newId);
        } catch (err) {
            showToast(err.message || "Update failed", "error");
        }
    });

    document.getElementById("save-access").addEventListener("click", async () => {
        const accessPayload = readAccessValues("staff-access", accessValues);
        try {
            await api(`/api/staff/${member.id}/access`, {
                method: "PATCH",
                body: JSON.stringify(accessPayload)
            });
            showUndo("Access updated", async () => {
                await api(`/api/staff/${member.id}/access`, {
                    method: "PATCH",
                    body: JSON.stringify(previousAccess)
                });
                await loadAccessLevels();
                await searchStaff();
                await selectStaff(member.id);
            });
            await loadAccessLevels();
            await searchStaff();
            await selectStaff(member.id);
        } catch (err) {
            showToast(err.message || "Update failed", "error");
        }
    });

    document.getElementById("delete-staff").addEventListener("click", async () => {
        await deleteStaff(member.id);
    });
}

async function deleteStaff(staffId) {
    if (!Number.isInteger(staffId)) return;
    if (!confirm(`Delete staff #${staffId}?`)) return;

    try {
        await api(`/api/staff/${staffId}`, {method: "DELETE"});
        state.selectedStaffId = null;
        staffDetail.innerHTML = `<div class="detail-empty">Select a staff member to edit.</div>`;
        await searchStaff();
        showToast("Staff deleted");
    } catch (err) {
        showToast(err.message || "Delete failed", "error");
    }
}

async function loadAccessLevels() {
    try {
        const data = await api("/api/access-levels");
        state.accessLevels = data.accessLevels || [];
    } catch (err) {
        state.accessLevels = [];
    }
    renderStaffCreateOptions();
    updateStaffCreateButtons();
    if (state.createMode.staff) {
        renderStaffCreateTemplate();
    }
}
