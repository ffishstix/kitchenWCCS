const TOKEN_MAX_AGE_SECONDS = 6 * 30 * 24 * 60 * 60;
let searchTimer = null;
let staffSearchTimer = null;
let categorySearchTimer = null;
let reportCategoryTimer = null;
let reportItemTimer = null;
let authAttempt = 0;

const state = {
    token: null,
    items: [],
    selectedItemId: null,
    categories: [],
    selectedCategoryId: null,
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

const categorySearchInput = document.getElementById("category-search");
const categoryResults = document.getElementById("category-results");
const categoryDetail = document.getElementById("category-detail");

const staffSearchInput = document.getElementById("staff-search");
const staffResults = document.getElementById("staff-results");
const staffDetail = document.getElementById("staff-detail");

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
        searchCategoriesManager()
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

async function selectCategory(categoryId) {
    state.selectedCategoryId = categoryId;
    for (const li of categoryResults.querySelectorAll("li")) {
        li.classList.toggle("active", Number(li.dataset.id) === categoryId);
    }

    categoryDetail.innerHTML = `<div class="detail-empty">Loading category...</div>`;

    try {
        const data = await api(`/api/categories/${categoryId}`);
        renderCategoryDetail(data.category);
    } catch (err) {
        categoryDetail.innerHTML = `<div class="detail-empty">Failed to load category.</div>`;
    }
}

function renderCategoryDetail(category) {
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
        </div>
    `;

    initColorPicker("category-colour");
    document.getElementById("save-category").addEventListener("click", () => {
        saveCategoryChanges(category.categoryId);
    });
}

async function saveCategoryChanges(categoryId) {
    const chosenColour = document.getElementById("category-colour").value.trim();
    if (chosenColour && !isValidColorName(chosenColour)) {
        showToast("Choose a valid C# Color", "error");
        return;
    }

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
        showToast("Category updated");
        await searchCategoriesManager();
    } catch (err) {
        showToast(err.message || "Update failed", "error");
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
        renderItemDetail(data.item, data.categories || []);
    } catch (err) {
        itemDetail.innerHTML = `<div class="detail-empty">Failed to load item.</div>`;
    }
}

function renderItemDetail(item, categories) {
    state.selectedCategoryId = null;

    const categoryChips = categories.length
        ? categories.map(cat => `<span class="chip">${escapeHtml(cat.catName)} (#${cat.categoryId})</span>`).join("")
        : `<span class="muted">No category assigned.</span>`;

    itemDetail.innerHTML = `
        <div class="form-grid">
            <div class="form-field">
                <label class="label">Item name</label>
                <input id="item-name" value="${escapeHtml(item.itemName ?? "")}" />
            </div>
            <div class="form-field">
                <label class="label">Price</label>
                <input id="item-price" value="${item.price ?? ""}" />
            </div>
            <div class="form-field">
                <label class="label">Colour</label>
                ${buildColorPicker("item-colour", item.chosenColour ?? "")}
            </div>
            <div class="form-field">
                <label class="label">Sub category ID</label>
                <input id="item-subcat" value="${item.subCatId ?? ""}" />
            </div>
            <div class="form-field">
                <label class="label">Sub item order</label>
                <input id="item-suborder" value="${item.subItemOrder ?? ""}" />
            </div>
            <div class="form-field">
                <label class="label">Leads to category</label>
                <input id="item-leads" value="${item.leadsToCategoryId ?? ""}" />
            </div>
            <div class="form-field">
                <label class="label">Made in kitchen</label>
                <select id="item-made">
                    <option value="1" ${Number(item.madeInKitchen) === 1 ? "selected" : ""}>Yes</option>
                    <option value="0" ${Number(item.madeInKitchen) === 0 ? "selected" : ""}>No</option>
                </select>
            </div>
            <div class="form-field" style="grid-column: 1 / -1;">
                <label class="label">Extra info</label>
                <textarea id="item-extra">${escapeHtml(item.extraInfo ?? "")}</textarea>
            </div>
        </div>
        <div class="actions" style="margin-top: 14px;">
            <button class="btn primary" id="save-item">Save item changes</button>
        </div>

        <div style="margin-top: 20px;">
            <div class="label">Current categories</div>
            <div class="chips" id="current-categories" style="margin-top: 8px;">${categoryChips}</div>
        </div>

        <div style="margin-top: 16px;">
            <div class="label">modify category</div>
            <div class="form-grid" style="margin-top: 8px;">
                <div class="form-field">
                    <label class="label">Category search</label>
                    <input id="item-category-search" placeholder="Search by name" />
                    <ul class="list" id="item-category-results" style="max-height: 160px;"></ul>
                </div>
                <div class="form-field">
                    <label class="label">Category ID</label>
                    <input id="item-category-id" placeholder="Enter ID" />
                    <div class="actions" style="margin-top: 10px;">
                        <button class="btn secondary" id="item-add-category">Add category</button>
                        <button class="btn primary" id="item-move-category">Move categories</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const saveButton = document.getElementById("save-item");
    initColorPicker("item-colour");
    const categorySearch = document.getElementById("item-category-search");
    const categoryResults = document.getElementById("item-category-results");
    const categoryIdInput = document.getElementById("item-category-id");
    const addCategoryBtn = document.getElementById("item-add-category");
    const moveCategoryBtn = document.getElementById("item-move-category");

    saveButton.addEventListener("click", () => saveItemChanges(item.itemId));

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
            showToast("Category added");
            const updated = await api(`/api/items/${item.itemId}`);
            renderItemDetail(updated.item, updated.categories || []);
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
        try {
            await api(`/api/items/${item.itemId}/category`, {
                method: "POST",
                body: JSON.stringify({categoryId: targetId})
            });
            showToast("Categories moved");
            const updated = await api(`/api/items/${item.itemId}`);
            renderItemDetail(updated.item, updated.categories || []);
        } catch (err) {
            showToast(err.message || "Category move failed", "error");
        }
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

    try {
        await api(`/api/items/${itemId}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        });
        showToast("Item updated");
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
        try {
            await api(`/api/staff/${member.id}/access`, {
                method: "PATCH",
                body: JSON.stringify({accessLevel: accessSelect.value})
            });
            showToast("Access updated");
            await searchStaff();
        } catch (err) {
            showToast(err.message || "Update failed", "error");
        }
    });
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

staffSearchInput.addEventListener("input", () => {
    if (staffSearchTimer) clearTimeout(staffSearchTimer);
    staffSearchTimer = setTimeout(searchStaff, 250);
});

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

