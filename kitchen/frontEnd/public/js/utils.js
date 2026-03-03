window.logWith = (level, context, message, data) => {
    const line = `[${context}] ${message}`;
    if (data !== undefined) {
        console[level](line, data);
    } else {
        console[level](line);
    }
};

const logWith = window.logWith;

window.isSocketOpen = () => socket && socket.readyState === WebSocket.OPEN;
