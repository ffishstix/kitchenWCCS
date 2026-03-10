const authStatus = document.getElementById("auth-status");
const loginPanel = document.getElementById("login-panel");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

const topTableBody = document.getElementById("top-table-body");
const refreshTopBtn = document.getElementById("refresh-top");

const openTableBody = document.getElementById("open-table-body");
const openTableSummary = document.getElementById("open-table-summary");
const refreshOpenTablesBtn = document.getElementById("refresh-open-tables");
const openTableFilter = document.getElementById("open-table-filter");

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
const categoryCreateColourPicker = document.getElementById("category-create-colour-picker");
let categoryCreateColour = document.getElementById("category-create-colour");
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
const staffCreateId = document.getElementById("staff-create-id");
const staffCreateName = document.getElementById("staff-create-name");
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
