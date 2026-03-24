function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function showToast(message, tone = "dark") {
    toast.textContent = message;
    toast.style.background = tone === "error" ? "#d1493f" : "#201a14";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
}

function showUndo(message, onUndo) {
    const undoToken = ++undoCounter;
    toast.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button class="toast-action" type="button">Undo</button>
    `;
    toast.style.background = "#201a14";
    toast.classList.add("show");

    const button = toast.querySelector(".toast-action");
    const timeout = setTimeout(() => {
        if (authAttempt === undoToken) {
            toast.classList.remove("show");
        }
    }, 5000);

    button.addEventListener("click", async () => {
        if (authAttempt !== undoToken) return;
        clearTimeout(timeout);
        toast.classList.remove("show");
        try {
            await onUndo();
        } catch (err) {
            showToast("Undo failed", "error");
        }
    }, {once: true});
}

function isValidColorName(value) {
    return COLOR_LOOKUP.has(String(value || "").toLowerCase());
}

function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatPrice(penceValue) {
    const value = Number(penceValue);
    if (!Number.isFinite(value)) return "-";
    const pounds = value / 100;
    return `\u00A3${pounds.toFixed(2)}`;
}

function buildCategoryChips(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
        return `<span class="muted">No category assigned.</span>`;
    }
    return categories.map(cat => `
        <span class="chip">
            ${escapeHtml(cat.catName)} (#${cat.categoryId})
            <button type="button" data-category-id="${cat.categoryId}" aria-label="Remove">&times;</button>
        </span>
    `).join("");
}

function buildAllergyChips(allergies) {
    if (!Array.isArray(allergies) || allergies.length === 0) {
        return `<span class="muted">No allergies assigned.</span>`;
    }
    return allergies.map(allergy => `
        <span class="chip">
            ${escapeHtml(allergy.allergyName)} (#${allergy.allergyId})
            <button type="button" data-allergy-id="${allergy.allergyId}" aria-label="Remove">&times;</button>
        </span>
    `).join("");
}

function getCategoryOpenSet(categoryId) {
    if (!state.categoryOpenEditors) {
        state.categoryOpenEditors = new Map();
    }
    let set = state.categoryOpenEditors.get(categoryId);
    if (!set) {
        set = new Set();
        state.categoryOpenEditors.set(categoryId, set);
    }
    return set;
}

// Build the color picker markup with the current selection.
function buildColorPicker(id, currentValue) {
    const current = String(currentValue || "").trim();
    const invalid = current && !isValidColorName(current);
    const safeCurrent = invalid ? "" : current;
    const label = invalid ? `Current (invalid): ${current}` : (current || "Select colour");
    const swatchColor = invalid ? "transparent" : (current || "transparent");
    const invalidOption = invalid
        ? `<button type="button" class="color-option" data-value="${escapeHtml(current)}" data-label="Current (invalid): ${escapeHtml(current)}">
                <span class="swatch" style="background: transparent;"></span>
                <span class="label">Current (invalid): ${escapeHtml(current)}</span>
           </button>`
        : "";

    const options = COLOR_OPTIONS.map(color => `
        <button type="button" class="color-option" data-value="${color}" data-label="${color}">
            <span class="swatch" style="background: ${color};"></span>
            <span class="label">${color}</span>
        </button>
    `).join("");

    return `
        <div class="color-picker" data-picker="${id}">
            <input type="hidden" id="${id}" value="${escapeHtml(safeCurrent)}" />
            <button type="button" class="color-picker-btn">
                <span class="swatch color-picker-swatch" style="background: ${escapeHtml(swatchColor)};"></span>
                <span class="label color-picker-label">${escapeHtml(label)}</span>
                <span class="caret">&#9662;</span>
            </button>
            <div class="color-picker-menu">
                <button type="button" class="color-option" data-value="" data-label="Select colour">
                    <span class="swatch" style="background: transparent;"></span>
                    <span class="label">Select colour</span>
                </button>
                ${invalidOption}
                ${options}
            </div>
        </div>
    `;
}

function closeAllColorPickers() {
    document.querySelectorAll(".color-picker").forEach(picker => {
        picker.classList.remove("open");
    });
}

// Wire the color picker interactions for a specific field.
function initColorPicker(id) {
    const picker = document.querySelector(`.color-picker[data-picker="${id}"]`);
    if (!picker) return;

    const input = picker.querySelector(`#${id}`);
    const button = picker.querySelector(".color-picker-btn");
    const menu = picker.querySelector(".color-picker-menu");
    const label = picker.querySelector(".color-picker-label");
    const swatch = picker.querySelector(".color-picker-swatch");

    const setValue = (value, text, emit = false) => {
        input.value = value;
        label.textContent = text || "Select colour";
        swatch.style.background = value || "transparent";
        if (emit) {
            input.dispatchEvent(new Event("input", {bubbles: true}));
            input.dispatchEvent(new Event("change", {bubbles: true}));
        }
    };

    button.addEventListener("click", event => {
        event.stopPropagation();
        const isOpen = picker.classList.contains("open");
        closeAllColorPickers();
        if (!isOpen) picker.classList.add("open");
    });

    menu.addEventListener("click", event => {
        const option = event.target.closest(".color-option");
        if (!option) return;
        const value = option.dataset.value || "";
        const text = option.dataset.label || "Select colour";
        setValue(value, text, true);
        picker.classList.remove("open");
    });

    if (!colorPickerListenerAttached) {
        document.addEventListener("click", closeAllColorPickers);
        colorPickerListenerAttached = true;
    }
}

function resetColorPicker(id) {
    const picker = document.querySelector(`.color-picker[data-picker="${id}"]`);
    if (!picker) return;
    const input = picker.querySelector(`#${id}`);
    const label = picker.querySelector(".color-picker-label");
    const swatch = picker.querySelector(".color-picker-swatch");
    if (input) input.value = "";
    if (label) label.textContent = "Select colour";
    if (swatch) swatch.style.background = "transparent";
}

// Track edits and debounce save calls for a container.
function attachAutoSave(container, saveFn, shouldSave = null, debounceMs = 250) {
    if (!container || typeof saveFn !== "function") return;
    if (container._autoSaveCleanup) {
        container._autoSaveCleanup();
    }

    let timer = null;
    let inFlight = false;
    let queued = false;

    const runSave = async () => {
        if (inFlight) {
            queued = true;
            return;
        }
        if (shouldSave && !shouldSave()) return;
        inFlight = true;
        try {
            await saveFn();
        } finally {
            inFlight = false;
            if (queued) {
                queued = false;
                runSave();
            }
        }
    };

    const scheduleSave = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(runSave, debounceMs);
    };

    const onPointerDown = (event) => {
        if (!event.target || !container.contains(event.target)) {
            scheduleSave();
        }
    };

    const onFocusOut = (event) => {
        if (!container.contains(event.relatedTarget)) {
            scheduleSave();
        }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    container.addEventListener("focusout", onFocusOut);

    container._autoSaveCleanup = () => {
        document.removeEventListener("pointerdown", onPointerDown, true);
        container.removeEventListener("focusout", onFocusOut);
        if (timer) clearTimeout(timer);
    };
}

function clearActiveList(container) {
    if (!container) return;
    container.querySelectorAll(".active").forEach(li => li.classList.remove("active"));
}

function getInputValueById(id, fallbackElement = null) {
    const element = document.getElementById(id);
    if (element) return element.value;
    return fallbackElement ? fallbackElement.value : "";
}

function renderPendingItemChips(container, pendingItems, emptyLabel) {
    if (!container) return;
    if (!pendingItems.length) {
        container.innerHTML = `<span class="muted">${escapeHtml(emptyLabel)}</span>`;
        return;
    }
    container.innerHTML = pendingItems
        .map(item => `
            <span class="chip">
                ${escapeHtml(item.name)} <span class="muted">#${item.id}</span>
                <button data-id="${item.id}" aria-label="Remove">&times;</button>
            </span>
        `)
        .join("");
}
