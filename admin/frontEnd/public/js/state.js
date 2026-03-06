let searchTimer = null;
let staffSearchTimer = null;
let categorySearchTimer = null;
let allergySearchTimer = null;
let reportCategoryTimer = null;
let reportItemTimer = null;
let authAttempt = 0;
let undoCounter = 0;
let colorPickerListenerAttached = false;

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
    staffAccessDraft: null,
    reportCategories: [],
    reportItems: [],
    createMode: {
        item: false,
        category: false,
        allergy: false,
        staff: false
    },
    pendingCategoryItems: [],
    pendingAllergyItems: []
};
