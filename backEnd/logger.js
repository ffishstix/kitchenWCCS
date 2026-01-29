const readline = require("readline");

let lastKey = "";
let lastCount = 0;
let lastStream = null;

function logWith(level, context, message) {
    const key = `${level}:${context}:${message}`;
    if (key === lastKey) {
        lastCount += 1;
        const line = `(${lastCount}) [${context}] ${message}`;
        const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
        if (stream.isTTY && lastStream === stream) {
            readline.moveCursor(stream, 0, -1);
            readline.clearLine(stream, 0);
            readline.cursorTo(stream, 0);
            stream.write(`${line}\n`);
        } else {
            console[level](line);
        }
        return;
    }

    lastKey = key;
    lastCount = 1;
    const line = `[${context}] ${message}`;
    const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
    lastStream = stream;
    console[level](line);
}

module.exports = {
    logWith
};
