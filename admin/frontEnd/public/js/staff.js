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

function renderStaffCreateOptions() {
    if (!staffCreateAccess) return;
    if (!state.accessLevels.length) {
        staffCreateAccess.innerHTML = `<option value="">No access levels</option>`;
        staffCreateAccess.disabled = true;
        updateStaffCreateButtons();
        return;
    }
    staffCreateAccess.disabled = false;
    staffCreateAccess.innerHTML = state.accessLevels
        .map(level => `<option value="${level.accessLevel}">${level.accessLevel}</option>`)
        .join("");
    updateStaffCreateButtons();
}

async function createStaff(useTemplate = null) {
    const fromTemplate = useTemplate === null ? state.createMode.staff : useTemplate;
    const staffIdValue = (fromTemplate
        ? getInputValueById("staff-new-id", staffCreateId)
        : staffCreateId.value
    ).trim();
    const staffId = Number.parseInt(staffIdValue, 10);
    const name = (fromTemplate
        ? getInputValueById("staff-new-name", staffCreateName)
        : staffCreateName.value
    ).trim();
    const accessLevel = fromTemplate
        ? getInputValueById("staff-new-access", staffCreateAccess)
        : staffCreateAccess.value;

    if (!Number.isInteger(staffId)) {
        showToast("Enter a staff ID", "error");
        return;
    }
    if (!name) {
        showToast("Enter a staff name", "error");
        return;
    }
    if (!accessLevel) {
        showToast("Select an access level", "error");
        return;
    }

    try {
        const data = await api("/api/staff", {
            method: "POST",
            body: JSON.stringify({staffId, name, accessLevel})
        });
        staffCreateId.value = "";
        staffCreateName.value = "";
        updateStaffCreateButtons();
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
    const accessLevel = getInputValueById("staff-new-access", staffCreateAccess);
    return Number.isInteger(staffId) && Boolean(name) && Boolean(accessLevel);
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

    const nameValue = staffCreateName.value.trim();
    const idValue = staffCreateId.value.trim();
    const accessValue = staffCreateAccess.value || "";
    const options = state.accessLevels.length
        ? state.accessLevels.map(level => `<option value="${level.accessLevel}">${level.accessLevel}</option>`).join("")
        : `<option value="">No access levels</option>`;

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
                <label class="label">Access level</label>
                <select id="staff-new-access" ${state.accessLevels.length ? "" : "disabled"}>
                    ${options}
                </select>
            </div>
        </div>
        <div class="actions" style="margin-top: 14px;">
            <button class="btn primary" id="staff-template-create">Create staff</button>
        </div>
        <div class="access-card" id="staff-new-access-details" style="margin-top: 14px;"></div>
    `;

    const accessSelect = document.getElementById("staff-new-access");
    if (accessSelect && accessValue) {
        accessSelect.value = accessValue;
    }

    wireStaffCreateTemplate();
}

function wireStaffCreateTemplate() {
    const idInput = document.getElementById("staff-new-id");
    const nameInput = document.getElementById("staff-new-name");
    const accessSelect = document.getElementById("staff-new-access");
    const createButton = document.getElementById("staff-template-create");
    const accessDetails = document.getElementById("staff-new-access-details");

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

    if (accessSelect) {
        accessSelect.addEventListener("change", () => {
            if (staffCreateAccess.value !== accessSelect.value) {
                staffCreateAccess.value = accessSelect.value;
            }
            updateAccessDetails(accessSelect.value, accessDetails);
            updateStaffCreateButtons();
        });
        updateAccessDetails(accessSelect.value, accessDetails);
    } else if (accessDetails) {
        accessDetails.textContent = "Access level details unavailable.";
    }

    if (createButton) {
        createButton.addEventListener("click", () => createStaff(true));
    }

    updateStaffCreateButtons();
}

function syncStaffCreateFromLeft() {
    if (!state.createMode.staff) {
        updateStaffCreateButtons();
        return;
    }
    const idInput = document.getElementById("staff-new-id");
    const nameInput = document.getElementById("staff-new-name");
    const accessSelect = document.getElementById("staff-new-access");
    const accessDetails = document.getElementById("staff-new-access-details");
    if (idInput && idInput.value !== staffCreateId.value) {
        idInput.value = staffCreateId.value;
    }
    if (nameInput && nameInput.value !== staffCreateName.value) {
        nameInput.value = staffCreateName.value;
    }
    if (accessSelect && accessSelect.value !== staffCreateAccess.value) {
        accessSelect.value = staffCreateAccess.value;
        updateAccessDetails(accessSelect.value, accessDetails);
    }
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
    const options = state.accessLevels
        .map(level => `<option value="${level.accessLevel}">${level.accessLevel}</option>`)
        .join("");

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
                <label class="label">Access level</label>
                <select id="staff-access">
                    ${options}
                </select>
            </div>
        </div>
        <div class="actions" style="margin-top: 14px;">
            <button class="btn primary" id="save-staff">Save staff details</button>
            <button class="btn secondary" id="save-access">Update access</button>
            <button class="btn danger" id="delete-staff">Delete staff</button>
        </div>
        <div class="access-card" id="access-details" style="margin-top: 14px;"></div>
    `;

    const accessSelect = document.getElementById("staff-access");
    accessSelect.value = member.accessLevel;

    const accessDetails = document.getElementById("access-details");
    updateAccessDetails(accessSelect.value, accessDetails);

    accessSelect.addEventListener("change", () => {
        updateAccessDetails(accessSelect.value, accessDetails);
    });

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
        const previousAccess = member.accessLevel;
        try {
            await api(`/api/staff/${member.id}/access`, {
                method: "PATCH",
                body: JSON.stringify({accessLevel: accessSelect.value})
            });
            showUndo("Access updated", async () => {
                await api(`/api/staff/${member.id}/access`, {
                    method: "PATCH",
                    body: JSON.stringify({accessLevel: previousAccess})
                });
                await searchStaff();
            });
            await searchStaff();
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

function updateAccessDetails(levelValue, container) {
    const level = state.accessLevels.find(item => String(item.accessLevel) === String(levelValue));
    if (!level) {
        container.textContent = "Access level details unavailable.";
        return;
    }

    container.innerHTML = `
        <div>Send through items: ${Number(level.canSendThroughItems) ? "Yes" : "No"}</div>
        <div>Delete: ${Number(level.canDelete) ? "Yes" : "No"}</div>
        <div>No sale: ${Number(level.canNoSale) ? "Yes" : "No"}</div>
        <div>View tables: ${Number(level.canViewTables) ? "Yes" : "No"}</div>
    `;
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
