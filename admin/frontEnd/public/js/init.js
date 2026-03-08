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
    renderItemCreateTemplate();
    updateCategoryCreateButtons();
    updateAllergyCreateButtons();
    updateStaffCreateButtons();
}

function initCategoryCreateColorPicker() {
    if (!categoryCreateColourPicker) return;
    const currentValue = categoryCreateColour ? categoryCreateColour.value : "";
    categoryCreateColourPicker.innerHTML = buildColorPicker("category-create-colour", currentValue);
    initColorPicker("category-create-colour");
    categoryCreateColour = document.getElementById("category-create-colour");
    const pickerButton = categoryCreateColourPicker.querySelector(".color-picker-btn");
    if (pickerButton) {
        pickerButton.addEventListener("click", activateCategoryCreateTemplate);
    }
}

initCategoryCreateColorPicker();

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

itemCreateName.addEventListener("focus", activateItemCreateTemplate);
itemCreatePrice.addEventListener("focus", activateItemCreateTemplate);
itemCreateName.addEventListener("input", syncItemCreateFromLeft);
itemCreatePrice.addEventListener("input", syncItemCreateFromLeft);

categoryCreateName.addEventListener("focus", activateCategoryCreateTemplate);
categoryCreateName.addEventListener("input", syncCategoryCreateFromLeft);
if (categoryCreateColour) {
    categoryCreateColour.addEventListener("focus", activateCategoryCreateTemplate);
    categoryCreateColour.addEventListener("input", syncCategoryCreateFromLeft);
}

allergyCreateName.addEventListener("focus", activateAllergyCreateTemplate);
allergyCreateName.addEventListener("input", syncAllergyCreateFromLeft);

staffCreateName.addEventListener("focus", activateStaffCreateTemplate);
if (staffCreateId) {
    staffCreateId.addEventListener("focus", activateStaffCreateTemplate);
    staffCreateId.addEventListener("input", syncStaffCreateFromLeft);
}
staffCreateName.addEventListener("input", syncStaffCreateFromLeft);

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

renderItemCreateTemplate();
updateItemCreateButtons();
updateCategoryCreateButtons();
updateAllergyCreateButtons();
updateStaffCreateButtons();

attemptAutoLogin();
