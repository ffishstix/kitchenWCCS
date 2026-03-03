let socket;
let ordersCache = [];
let currentOrderView = ORDER_VIEW_ACTIVE;
let reconnectTimer = null;
let reconnectDelayMs = RECONNECT_DELAY_BASE_MS;

let lastCardsData = null;
let resizeTimer = null;
let timerInterval = null;

window.ordersCache = ordersCache;
window.currentOrderView = currentOrderView;
