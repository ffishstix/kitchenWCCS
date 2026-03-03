const TOKEN_MAX_AGE_SECONDS = 6 * 30 * 24 * 60 * 60;
let searchTimer = null;
let staffSearchTimer = null;
let categorySearchTimer = null;
let allergySearchTimer = null;
let reportCategoryTimer = null;
let reportItemTimer = null;
let authAttempt = 0;
let undoCounter = 0;

const state = {
    token: null,
    items: [],
    selectedItemId: null,
    currentItem: null,
    currentItemCategories: [],
    categories: [],
    selectedCategoryId: null,
    currentCategory: null,
    categoryOpenEditors: new Map(),
    allergies: [],
    selectedAllergyId: null,
    currentAllergy: null,
    staff: [],
    selectedStaffId: null,
    accessLevels: [],
    reportCategories: [],
    reportItems: []
};

const authStatus = document.getElementById("auth-status");
const loginPanel = document.getElementById("login-panel");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

const topTableBody = document.getElementById("top-table-body");
const refreshTopBtn = document.getElementById("refresh-top");

const itemSearchInput = document.getElementById("item-search");
const itemResults = document.getElementById("item-results");
const itemDetail = document.getElementById("item-detail");
const itemCreateName = document.getElementById("item-create-name");
const itemCreatePrice = document.getElementById("item-create-price");
const itemCreateBtn = document.getElementById("item-create-btn");

const categorySearchInput = document.getElementById("category-search");
const categoryResults = document.getElementById("category-results");
const categoryDetail = document.getElementById("category-detail");
const categoryCreateName = document.getElementById("category-create-name");
const categoryCreateColour = document.getElementById("category-create-colour");
const categoryCreateBtn = document.getElementById("category-create-btn");

const allergySearchInput = document.getElementById("allergy-search");
const allergySortSelect = document.getElementById("allergy-sort");
const allergyResults = document.getElementById("allergy-results");
const allergyDetail = document.getElementById("allergy-detail");
const allergyCreateName = document.getElementById("allergy-create-name");
const allergyCreateBtn = document.getElementById("allergy-create-btn");

const staffSearchInput = document.getElementById("staff-search");
const staffResults = document.getElementById("staff-results");
const staffDetail = document.getElementById("staff-detail");
const staffCreateName = document.getElementById("staff-create-name");
const staffCreateAccess = document.getElementById("staff-create-access");
const staffCreateBtn = document.getElementById("staff-create-btn");

const reportStartInput = document.getElementById("report-start");
const reportEndInput = document.getElementById("report-end");
const reportCategorySearch = document.getElementById("report-category-search");
const reportCategoryResults = document.getElementById("report-category-results");
const reportCategoryChips = document.getElementById("report-category-chips");
const reportItemSearch = document.getElementById("report-item-search");
const reportItemResults = document.getElementById("report-item-results");
const reportItemChips = document.getElementById("report-item-chips");
const reportRunBtn = document.getElementById("report-run");
const reportClearBtn = document.getElementById("report-clear");
const reportPrintBtn = document.getElementById("report-print");
const reportTableBody = document.getElementById("report-table-body");
const reportSummary = document.getElementById("report-summary");

const toast = document.getElementById("toast");

const COLOR_OPTIONS = [
    "AliceBlue",
    "AntiqueWhite",
    "Aqua",
    "Aquamarine",
    "Azure",
    "Beige",
    "Bisque",
    "Black",
    "BlanchedAlmond",
    "Blue",
    "BlueViolet",
    "Brown",
    "BurlyWood",
    "CadetBlue",
    "Chartreuse",
    "Chocolate",
    "Coral",
    "CornflowerBlue",
    "Cornsilk",
    "Crimson",
    "Cyan",
    "DarkBlue",
    "DarkCyan",
    "DarkGoldenrod",
    "DarkGray",
    "DarkGreen",
    "DarkKhaki",
    "DarkMagenta",
    "DarkOliveGreen",
    "DarkOrange",
    "DarkOrchid",
    "DarkRed",
    "DarkSalmon",
    "DarkSeaGreen",
    "DarkSlateBlue",
    "DarkSlateGray",
    "DarkTurquoise",
    "DarkViolet",
    "DeepPink",
    "DeepSkyBlue",
    "DimGray",
    "DodgerBlue",
    "Firebrick",
    "FloralWhite",
    "ForestGreen",
    "Fuchsia",
    "Gainsboro",
    "GhostWhite",
    "Gold",
    "Goldenrod",
    "Gray",
    "Green",
    "GreenYellow",
    "Honeydew",
    "HotPink",
    "IndianRed",
    "Indigo",
    "Ivory",
    "Khaki",
    "Lavender",
    "LavenderBlush",
    "LawnGreen",
    "LemonChiffon",
    "LightBlue",
    "LightCoral",
    "LightCyan",
    "LightGoldenrodYellow",
    "LightGray",
    "LightGreen",
    "LightPink",
    "LightSalmon",
    "LightSeaGreen",
    "LightSkyBlue",
    "LightSlateGray",
    "LightSteelBlue",
    "LightYellow",
    "Lime",
    "LimeGreen",
    "Linen",
    "Magenta",
    "Maroon",
    "MediumAquamarine",
    "MediumBlue",
    "MediumOrchid",
    "MediumPurple",
    "MediumSeaGreen",
    "MediumSlateBlue",
    "MediumSpringGreen",
    "MediumTurquoise",
    "MediumVioletRed",
    "MidnightBlue",
    "MintCream",
    "MistyRose",
    "Moccasin",
    "NavajoWhite",
    "Navy",
    "OldLace",
    "Olive",
    "OliveDrab",
    "Orange",
    "OrangeRed",
    "Orchid",
    "PaleGoldenrod",
    "PaleGreen",
    "PaleTurquoise",
    "PaleVioletRed",
    "PapayaWhip",
    "PeachPuff",
    "Peru",
    "Pink",
    "Plum",
    "PowderBlue",
    "Purple",
    "Red",
    "RosyBrown",
    "RoyalBlue",
    "SaddleBrown",
    "Salmon",
    "SandyBrown",
    "SeaGreen",
    "SeaShell",
    "Sienna",
    "Silver",
    "SkyBlue",
    "SlateBlue",
    "SlateGray",
    "Snow",
    "SpringGreen",
    "SteelBlue",
    "Tan",
    "Teal",
    "Thistle",
    "Tomato",
    "Transparent",
    "Turquoise",
    "Violet",
    "Wheat",
    "White",
    "WhiteSmoke",
    "Yellow",
    "YellowGreen"
];
const COLOR_LOOKUP = new Set(COLOR_OPTIONS.map(color => color.toLowerCase()));
let colorPickerListenerAttached = false;

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
    return `£${pounds.toFixed(2)}`;
}

function buildCategoryChips(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
        return `<span class="muted">No category assigned.</span>`;
    }
    return categories.map(cat => `
        <span class="chip">
            ${escapeHtml(cat.catName)} (#${cat.categoryId})
            <button type="button" data-category-id="${cat.categoryId}" aria-label="Remove">×</button>
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
            <button type="button" data-allergy-id="${allergy.allergyId}" aria-label="Remove">×</button>
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
                <span class="caret">▾</span>
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

function initColorPicker(id) {
    const picker = document.querySelector(`.color-picker[data-picker="${id}"]`);
    if (!picker) return;

    const input = picker.querySelector(`#${id}`);
    const button = picker.querySelector(".color-picker-btn");
    const menu = picker.querySelector(".color-picker-menu");
    const label = picker.querySelector(".color-picker-label");
    const swatch = picker.querySelector(".color-picker-swatch");

    const setValue = (value, text) => {
        input.value = value;
        label.textContent = text || "Select colour";
        swatch.style.background = value || "transparent";
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
        setValue(value, text);
        picker.classList.remove("open");
    });

    if (!colorPickerListenerAttached) {
        document.addEventListener("click", closeAllColorPickers);
        colorPickerListenerAttached = true;
    }
}

function setAuthUi(loggedIn, statusText) {
    if (loggedIn) {
        authStatus.textContent = statusText || "Signed in";
        loginPanel.style.display = "none";
        logoutBtn.style.display = "inline-flex";
    } else {
        authStatus.textContent = statusText || "Signed out";
        loginPanel.style.display = "flex";
        logoutBtn.style.display = "none";
    }
}

function getCookie(name) {
    const cookies = document.cookie.split(";").map(c => c.trim());
    for (const cookie of cookies) {
        const [key, value] = cookie.split("=");
        if (key === name) return decodeURIComponent(value || "");
    }
    return null;
}

function setAuthCookie(token) {
    document.cookie = `authToken=${encodeURIComponent(token)}; path=/; max-age=${TOKEN_MAX_AGE_SECONDS}`;
}

function clearAuthCookie() {
    document.cookie = "authToken=; path=/; max-age=0";
}

async function api(path, options = {}) {
    const headers = Object.assign({"Content-Type": "application/json"}, options.headers || {});
    if (state.token) headers["X-Auth-Token"] = state.token;

    const res = await fetch(path, {...options, headers});

    if (res.status === 401) {
        handleUnauthorized();
        throw new Error("Unauthorized");
    }

    let data = null;
    try {
        data = await res.json();
    } catch (err) {
        data = {};
    }

    if (!res.ok || data.success === false) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

function handleUnauthorized() {
    state.token = null;
    clearAuthCookie();
    setAuthUi(false);
    showToast("Session expired", "error");
}

async function hashCredentials(username, password) {
    const combined = username + password;
    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(combined)
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function attemptLogin() {
    authAttempt += 1;
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!username || !password) {
        showToast("Enter username and password", "error");
        return;
    }

    const credentialHash = await hashCredentials(username, password);

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({credentialHash})
        });

        let data = null;
        try {
            data = await res.json();
        } catch (err) {
            data = null;
        }

        if (!res.ok) {
            const message = data?.error
                || (res.status === 401 ? "Invalid credentials" : "Login failed");
            showToast(message, "error");
            return;
        }

        state.token = data.token;
        setAuthCookie(data.token);
        setAuthUi(true);
        showToast("Welcome back");
        await loadInitialData();
    } catch (err) {
        showToast("Login failed", "error");
    }
}

async function attemptAutoLogin() {
    const token = getCookie("authToken");
    if (!token) {
        setAuthUi(false);
        return;
    }

    const attemptId = ++authAttempt;
    state.token = token;
    setAuthUi(true, "Checking session...");
    try {
        await api("/api/session");
        if (authAttempt !== attemptId) return;
        setAuthUi(true);
        await loadInitialData();
    } catch (err) {
        if (authAttempt !== attemptId) return;
        if (err.message === "Unauthorized") {
            setAuthUi(false);
            return;
        }
        setAuthUi(true, "Signed in (offline)");
        showToast("Session check failed", "error");
    }
}

async function loadInitialData() {
    await Promise.all([
        loadTopItems(),
        loadAccessLevels(),
        searchItems(),
        searchStaff(),
        searchCategoriesManager(),
        searchAllergiesManager()
    ]);
    clearReportFilters();
}

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

async function createItem() {
    const name = itemCreateName.value.trim();
    const priceValue = itemCreatePrice.value.trim();
    const price = Number.parseInt(priceValue, 10);

    if (!name) {
        showToast("Enter an item name", "error");
        return;
    }
    if (!Number.isInteger(price)) {
        showToast("Enter a valid price (pence)", "error");
        return;
    }

    try {
        const data = await api("/api/items", {
            method: "POST",
            body: JSON.stringify({itemName: name, price})
        });
        itemCreateName.value = "";
        itemCreatePrice.value = "";
        await searchItems();
        if (data.item?.itemId) {
            selectItem(data.item.itemId);
        }
        showToast("Item added");
    } catch (err) {
        showToast(err.message || "Item create failed", "error");
    }
}

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

async function createCategory() {
    const name = categoryCreateName.value.trim();
    const chosenColour = categoryCreateColour.value.trim();

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
            body: JSON.stringify({catName: name, chosenColour})
        });
        categoryCreateName.value = "";
        categoryCreateColour.value = "";
        await searchCategoriesManager();
        if (data.category?.categoryId) {
            selectCategory(data.category.categoryId);
        }
        showToast("Category added");
    } catch (err) {
        showToast(err.message || "Category create failed", "error");
    }
}

async function selectCategory(categoryId) {
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

function renderCategoryDetail(category, items = []) {
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
            <div class="label">Items in category</div>
            <ul class="list removable" id="category-items" style="margin-top: 8px;">
                ${items.length
        ? items.map(item => `
                        <li class="category-item" data-id="${item.itemId}">
                            <div class="item-row">
                                <span>${escapeHtml(item.itemName)} <span class="muted">#${item.itemId}</span></span>
                                <div class="item-actions">
                                    <button class="remove-btn" type="button" data-item-id="${item.itemId}" aria-label="Remove">×</button>
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
}

async function saveCategoryChanges(categoryId) {
    const chosenColour = document.getElementById("category-colour").value.trim();
    if (chosenColour && !isValidColorName(chosenColour)) {
        showToast("Choose a valid C# Color", "error");
        return;
    }

    const previous = state.currentCategory ? {...state.currentCategory} : null;
    const payload = {
        catName: document.getElementById("category-name").value.trim(),
        chosenColour,
        extraCatInfo: document.getElementById("category-extra-cat").value.trim()
    };

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
            const restored = await api(`/api/categories/${categoryId}`);
            const items = await api(`/api/categories/${categoryId}/items`);
            renderCategoryDetail(restored.category, items.items || []);
        });
        await searchCategoriesManager();
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

async function createAllergy() {
    const name = allergyCreateName.value.trim();
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
        await searchAllergiesManager();
        if (data.allergy?.allergyId) {
            selectAllergy(data.allergy.allergyId);
        }
        showToast("Allergy added");
    } catch (err) {
        showToast(err.message || "Allergy create failed", "error");
    }
}

async function selectAllergy(allergyId) {
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
            <div class="label">Items with this allergy</div>
            <ul class="list removable" id="allergy-items" style="margin-top: 8px;">
                ${items.length
        ? items.map(item => `
                        <li data-id="${item.itemId}">
                            <div class="item-row">
                                <span>${escapeHtml(item.itemName)} <span class="muted">#${item.itemId}</span></span>
                                <button class="remove-btn" type="button" data-item-id="${item.itemId}" aria-label="Remove">×</button>
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
}

async function saveAllergyChanges(allergyId) {
    const name = document.getElementById("allergy-name").value.trim();
    const previous = state.currentAllergy ? {...state.currentAllergy} : null;

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
            const restored = await api(`/api/allergies/${allergyId}`);
            const items = await api(`/api/allergies/${allergyId}/items`);
            renderAllergyDetail(restored.allergy, items.items || []);
        });
        await searchAllergiesManager();
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

async function selectItem(itemId) {
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
    const name = getItemFieldValue(prefix, "name").trim();
    const priceValue = getItemFieldValue(prefix, "price").trim();
    const price = Number.parseInt(priceValue, 10);
    if (!Number.isInteger(price)) {
        showToast("Price must be a number", "error");
        return;
    }

    const chosenColour = getItemFieldValue(prefix, "colour").trim();
    if (chosenColour && !isValidColorName(chosenColour)) {
        showToast("Choose a valid C# Color", "error");
        return;
    }

    const payload = {
        itemName: name,
        price,
        chosenColour,
        extraInfo: getItemFieldValue(prefix, "extra").trim(),
        subCatId: getItemFieldValue(prefix, "subcat").trim() || null,
        subItemOrder: getItemFieldValue(prefix, "suborder").trim() || null,
        leadsToCategoryId: getItemFieldValue(prefix, "leads").trim() || null,
        madeInKitchen: getItemFieldValue(prefix, "made")
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
                    subCatId: currentItem.subCatId ?? null,
                    subItemOrder: currentItem.subItemOrder ?? null,
                    leadsToCategoryId: currentItem.leadsToCategoryId ?? null,
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
        itemDetail.innerHTML = `<div class="detail-empty">Select an item to edit.</div>`;
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
                <label class="label">Sub category ID</label>
                <input id="${prefix}-subcat" value="${item.subCatId ?? ""}" />
            </div>
            <div class="form-field">
                <label class="label">Sub item order</label>
                <input id="${prefix}-suborder" value="${item.subItemOrder ?? ""}" />
            </div>
            <div class="form-field">
                <label class="label">Leads to category</label>
                <input id="${prefix}-leads" value="${item.leadsToCategoryId ?? ""}" />
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
                <div class="form-field">
                    <label class="label">Category ID</label>
                    <input id="${prefix}-category-id" placeholder="Enter ID" />
                    <div class="actions" style="margin-top: 10px;">
                        <button class="btn secondary" id="${prefix}-add-category">Add category</button>
                        <button class="btn primary" id="${prefix}-move-category">Move categories</button>
                    </div>
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
                <div class="form-field">
                    <label class="label">Allergy ID</label>
                    <input id="${prefix}-allergy-id" placeholder="Enter ID" />
                    <button class="btn secondary" id="${prefix}-add-allergy" style="margin-top: 10px;">Add allergy</button>
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
    const categoryIdInput = document.getElementById(`${prefix}-category-id`);
    const addCategoryBtn = document.getElementById(`${prefix}-add-category`);
    const moveCategoryBtn = document.getElementById(`${prefix}-move-category`);
    const saveButton = document.getElementById(`${prefix}-save`);
    const deleteButton = document.getElementById(`${prefix}-delete`);
    const currentCategories = document.getElementById(`${prefix}-current-categories`);
    const allergySearch = document.getElementById(`${prefix}-allergy-search`);
    const allergyResults = document.getElementById(`${prefix}-allergy-results`);
    const allergyIdInput = document.getElementById(`${prefix}-allergy-id`);
    const addAllergyBtn = document.getElementById(`${prefix}-add-allergy`);
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
        categoryTimer = setTimeout(() => searchCategories(categorySearch.value, categoryResults, categoryIdInput), 250);
    });

    addCategoryBtn.addEventListener("click", async () => {
        const targetId = Number.parseInt(categoryIdInput.value, 10);
        if (!Number.isInteger(targetId)) {
            showToast("Enter a valid category ID", "error");
            return;
        }
        try {
            await api(`/api/items/${item.itemId}/category/add`, {
                method: "POST",
                body: JSON.stringify({categoryId: targetId})
            });
            showUndo("Category added", async () => {
                await api(`/api/items/${item.itemId}/category/remove`, {
                    method: "POST",
                    body: JSON.stringify({categoryId: targetId})
                });
                await refreshFn();
            });
            await refreshFn();
        } catch (err) {
            showToast(err.message || "Category add failed", "error");
        }
    });

    moveCategoryBtn.addEventListener("click", async () => {
        const targetId = Number.parseInt(categoryIdInput.value, 10);
        if (!Number.isInteger(targetId)) {
            showToast("Enter a valid category ID", "error");
            return;
        }
        const previousCategories = Array.isArray(categories)
            ? categories.map(cat => cat.categoryId)
            : [];
        try {
            await api(`/api/items/${item.itemId}/category`, {
                method: "POST",
                body: JSON.stringify({categoryId: targetId})
            });
            showUndo("Categories moved", async () => {
                if (previousCategories.length === 0) {
                    await api(`/api/items/${item.itemId}/category`, {
                        method: "POST",
                        body: JSON.stringify({categoryId: null})
                    });
                } else {
                    if (!previousCategories.includes(targetId)) {
                        await api(`/api/items/${item.itemId}/category/remove`, {
                            method: "POST",
                            body: JSON.stringify({categoryId: targetId})
                        });
                    }
                    for (const categoryId of previousCategories) {
                        await api(`/api/items/${item.itemId}/category/add`, {
                            method: "POST",
                            body: JSON.stringify({categoryId})
                        });
                    }
                }
                await refreshFn();
            });
            await refreshFn();
        } catch (err) {
            showToast(err.message || "Category move failed", "error");
        }
    });

    if (currentCategories) {
        attachCategoryChipRemoval(currentCategories, item.itemId, refreshFn);
    }

    if (allergySearch && allergyResults && allergyIdInput) {
        let allergyTimer = null;
        allergySearch.addEventListener("input", () => {
            if (allergyTimer) clearTimeout(allergyTimer);
            allergyTimer = setTimeout(() => searchAllergies(allergySearch.value, allergyResults, allergyIdInput), 250);
        });
    }

    if (addAllergyBtn) {
        addAllergyBtn.addEventListener("click", async () => {
            const targetId = Number.parseInt(allergyIdInput.value, 10);
            if (!Number.isInteger(targetId)) {
                showToast("Enter a valid allergy ID", "error");
                return;
            }
            try {
                await api(`/api/items/${item.itemId}/allergy/add`, {
                    method: "POST",
                    body: JSON.stringify({allergyId: targetId})
                });
                showUndo("Allergy added", async () => {
                    await api(`/api/items/${item.itemId}/allergy/remove`, {
                        method: "POST",
                        body: JSON.stringify({allergyId: targetId})
                    });
                    await refreshFn();
                });
                await refreshFn();
            } catch (err) {
                showToast(err.message || "Allergy add failed", "error");
            }
        });
    }

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
        wireItemEditor(prefix, data.item, data.categories || [], data.allergies || [], async () => {
            await renderInlineItemEditor(container, itemId, categoryId);
        });
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
    } catch (err) {
        container.innerHTML = `<div class="detail-empty">Failed to load item.</div>`;
    }
}

function renderItemDetail(item, categories, allergies) {
    state.selectedCategoryId = null;
    state.currentItem = item;
    state.currentItemCategories = Array.isArray(categories)
        ? categories.map(cat => cat.categoryId)
        : [];

    itemDetail.innerHTML = buildItemEditorMarkup(item, categories, allergies || [], "item");
    wireItemEditor("item", item, categories, allergies || [], async () => {
        await refreshItemDetail(item.itemId, "main");
    });
}
async function searchCategories(term, container, idInput) {
    container.innerHTML = `<li class="muted">Searching...</li>`;
    try {
        const data = await api(`/api/categories?search=${encodeURIComponent(term)}&limit=20`);
        if (!data.categories.length) {
            container.innerHTML = `<li class="muted">No categories.</li>`;
            return;
        }
        container.innerHTML = data.categories
            .map(cat => `
                <li data-id="${cat.categoryId}">${escapeHtml(cat.catName)} <span class="muted">#${cat.categoryId}</span></li>
            `)
            .join("");

        for (const li of container.querySelectorAll("li")) {
            li.addEventListener("click", () => {
                const id = Number.parseInt(li.dataset.id, 10);
                if (Number.isInteger(id)) {
                    idInput.value = id;
                    showToast(`Selected category #${id}`);
                }
            });
        }
    } catch (err) {
        container.innerHTML = `<li class="muted">Search failed.</li>`;
    }
}

async function searchAllergies(term, container, idInput) {
    container.innerHTML = `<li class="muted">Searching...</li>`;
    try {
        const data = await api(`/api/allergies?search=${encodeURIComponent(term)}&limit=20&sort=name`);
        if (!data.allergies.length) {
            container.innerHTML = `<li class="muted">No allergies.</li>`;
            return;
        }
        container.innerHTML = data.allergies
            .map(allergy => `
                <li data-id="${allergy.allergyId}">${escapeHtml(allergy.allergyName)} <span class="muted">#${allergy.allergyId}</span></li>
            `)
            .join("");

        for (const li of container.querySelectorAll("li")) {
            li.addEventListener("click", () => {
                const id = Number.parseInt(li.dataset.id, 10);
                if (Number.isInteger(id)) {
                    idInput.value = id;
                    showToast(`Selected allergy #${id}`);
                }
            });
        }
    } catch (err) {
        container.innerHTML = `<li class="muted">Search failed.</li>`;
    }
}

async function saveItemChanges(itemId) {
    const name = document.getElementById("item-name").value.trim();
    const priceValue = document.getElementById("item-price").value.trim();
    const price = Number.parseInt(priceValue, 10);
    if (!Number.isInteger(price)) {
        showToast("Price must be a number", "error");
        return;
    }

    const chosenColour = document.getElementById("item-colour").value.trim();
    if (chosenColour && !isValidColorName(chosenColour)) {
        showToast("Choose a valid C# Color", "error");
        return;
    }

    const payload = {
        itemName: name,
        price,
        chosenColour,
        extraInfo: document.getElementById("item-extra").value.trim(),
        subCatId: document.getElementById("item-subcat").value.trim() || null,
        subItemOrder: document.getElementById("item-suborder").value.trim() || null,
        leadsToCategoryId: document.getElementById("item-leads").value.trim() || null,
        madeInKitchen: document.getElementById("item-made").value
    };

    const previous = state.currentItem ? {...state.currentItem} : null;

    try {
        await api(`/api/items/${itemId}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        });
        showUndo("Item updated", async () => {
            if (!previous) return;
            await api(`/api/items/${itemId}`, {
                method: "PATCH",
                body: JSON.stringify({
                    itemName: previous.itemName ?? "",
                    price: previous.price ?? 0,
                    chosenColour: previous.chosenColour ?? "",
                    extraInfo: previous.extraInfo ?? "",
                    subCatId: previous.subCatId ?? null,
                    subItemOrder: previous.subItemOrder ?? null,
                    leadsToCategoryId: previous.leadsToCategoryId ?? null,
                    madeInKitchen: previous.madeInKitchen ?? 0
                })
            });
            const restored = await api(`/api/items/${itemId}`);
            renderItemDetail(restored.item, restored.categories || [], restored.allergies || []);
        });
        const updated = await api(`/api/items/${itemId}`);
        renderItemDetail(updated.item, updated.categories || [], updated.allergies || []);
        await searchItems();
    } catch (err) {
        showToast(err.message || "Update failed", "error");
    }
}

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
        return;
    }
    staffCreateAccess.disabled = false;
    staffCreateAccess.innerHTML = state.accessLevels
        .map(level => `<option value="${level.accessLevel}">${level.accessLevel}</option>`)
        .join("");
}

async function createStaff() {
    const name = staffCreateName.value.trim();
    const accessLevel = staffCreateAccess.value;

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
            body: JSON.stringify({name, accessLevel})
        });
        staffCreateName.value = "";
        await searchStaff();
        if (data.staff?.id) {
            selectStaff(data.staff.id);
        }
        showToast("Staff added");
    } catch (err) {
        showToast(err.message || "Staff create failed", "error");
    }
}

async function selectStaff(staffId) {
    state.selectedStaffId = staffId;
    for (const li of staffResults.querySelectorAll("li")) {
        li.classList.toggle("active", Number(li.dataset.id) === staffId);
    }

    const member = state.staff.find(item => item.id === staffId);
    if (!member) return;

    renderStaffDetail(member);
}

function renderStaffDetail(member) {
    const options = state.accessLevels
        .map(level => `<option value="${level.accessLevel}">${level.accessLevel}</option>`)
        .join("");

    staffDetail.innerHTML = `
        <div class="form-grid">
            <div class="form-field">
                <label class="label">Name</label>
                <input value="${escapeHtml(member.name ?? "")}" disabled />
            </div>
            <div class="form-field">
                <label class="label">Staff ID</label>
                <input value="${member.id}" disabled />
            </div>
            <div class="form-field">
                <label class="label">Access level</label>
                <select id="staff-access">
                    ${options}
                </select>
            </div>
        </div>
        <div class="actions" style="margin-top: 14px;">
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
}

function renderReportChips() {
    reportCategoryChips.innerHTML = state.reportCategories
        .map(item => `
            <span class="chip">
                ${escapeHtml(item.name)} #${item.id}
                <button data-type="category" data-id="${item.id}" aria-label="Remove">×</button>
            </span>
        `)
        .join("");

    reportItemChips.innerHTML = state.reportItems
        .map(item => `
            <span class="chip">
                ${escapeHtml(item.name)} #${item.id}
                <button data-type="item" data-id="${item.id}" aria-label="Remove">×</button>
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

    reportSummary.textContent = `Total sold: ${totalSold} · Revenue: ${formatPrice(totalRevenue)}`;
}

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

itemResults.addEventListener("click", event => {
    const li = event.target.closest("li");
    if (!li || !li.dataset.id) return;
    selectItem(Number(li.dataset.id));
});

categoryResults.addEventListener("click", event => {
    const li = event.target.closest("li");
    if (!li || !li.dataset.id) return;
    selectCategory(Number(li.dataset.id));
});

allergyResults.addEventListener("click", event => {
    const li = event.target.closest("li");
    if (!li || !li.dataset.id) return;
    selectAllergy(Number(li.dataset.id));
});

staffResults.addEventListener("click", event => {
    const li = event.target.closest("li");
    if (!li || !li.dataset.id) return;
    selectStaff(Number(li.dataset.id));
});

itemSearchInput.addEventListener("input", () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(searchItems, 250);
});

categorySearchInput.addEventListener("input", () => {
    if (categorySearchTimer) clearTimeout(categorySearchTimer);
    categorySearchTimer = setTimeout(searchCategoriesManager, 250);
});

allergySearchInput.addEventListener("input", () => {
    if (allergySearchTimer) clearTimeout(allergySearchTimer);
    allergySearchTimer = setTimeout(searchAllergiesManager, 250);
});

allergySortSelect.addEventListener("change", searchAllergiesManager);

staffSearchInput.addEventListener("input", () => {
    if (staffSearchTimer) clearTimeout(staffSearchTimer);
    staffSearchTimer = setTimeout(searchStaff, 250);
});

itemCreateBtn.addEventListener("click", createItem);
categoryCreateBtn.addEventListener("click", createCategory);
allergyCreateBtn.addEventListener("click", createAllergy);
staffCreateBtn.addEventListener("click", createStaff);

reportCategorySearch.addEventListener("input", () => {
    if (reportCategoryTimer) clearTimeout(reportCategoryTimer);
    reportCategoryTimer = setTimeout(searchReportCategories, 250);
});

reportItemSearch.addEventListener("input", () => {
    if (reportItemTimer) clearTimeout(reportItemTimer);
    reportItemTimer = setTimeout(searchReportItems, 250);
});

reportCategoryResults.addEventListener("click", event => {
    const li = event.target.closest("li");
    if (!li || !li.dataset.id) return;
    const id = Number(li.dataset.id);
    const name = li.dataset.name || li.textContent.replace(/#\d+/, "").trim();
    addReportFilter("category", {id, name});
});

reportItemResults.addEventListener("click", event => {
    const li = event.target.closest("li");
    if (!li || !li.dataset.id) return;
    const id = Number(li.dataset.id);
    const name = li.dataset.name || li.textContent.replace(/#\d+/, "").trim();
    addReportFilter("item", {id, name});
});

reportCategoryChips.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const id = Number(button.dataset.id);
    if (Number.isInteger(id)) removeReportFilter("category", id);
});

reportItemChips.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const id = Number(button.dataset.id);
    if (Number.isInteger(id)) removeReportFilter("item", id);
});

refreshTopBtn.addEventListener("click", loadTopItems);
loginBtn.addEventListener("click", attemptLogin);
logoutBtn.addEventListener("click", () => {
    state.token = null;
    clearAuthCookie();
    setAuthUi(false);
    showToast("Signed out");
});

reportRunBtn.addEventListener("click", runReport);
reportClearBtn.addEventListener("click", clearReportFilters);
reportPrintBtn.addEventListener("click", () => window.print());

attemptAutoLogin();

