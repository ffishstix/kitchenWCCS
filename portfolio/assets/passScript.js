// Variables
const password = "secret password";

// Lowercase letters in alphabetical order, then numbers and symbols.
const charCycleOrder = "abcdefghijklmnopqrstuvwxyz0123456789 -_!$%^&*():";
const randomPhaseDuration = 4000; // 4 seconds of random characters
const revealHoldDuration = 5000; // 5 seconds of showing the full password
const cycleSpeed = 80; // Milliseconds between each character change during reveal

const charCycleArray = charCycleOrder.split("");
const charIndexMap = new Map(charCycleArray.map((char, index) => [char, index]));

let activeRunId = 0;

function getRandomChar() {
    return charCycleArray[Math.floor(Math.random() * charCycleArray.length)];
}

function getRandomString(length) {
    return Array.from({length}, getRandomChar).join("");
}

function updatePassText(text) {
    const passElement = document.querySelector(".pass");
    if (!passElement) return;
    passElement.textContent = text;
}

function buildRevealText(currentIndex, currentChar) {
    const output = [];
    for (let i = 0; i < password.length; i++) {
        if (i < currentIndex) {
            output.push(password[i]);
        } else if (i === currentIndex) {
            output.push(currentChar);
        } else {
            output.push(getRandomChar());
        }
    }
    return output.join("");
}

function startEffect(_unused = true) {
    activeRunId += 1;
    const runId = activeRunId;

    if (!document.querySelector(".pass")) return;

    function randomPhase(elapsed = 0) {
        if (runId !== activeRunId) return;

        updatePassText(getRandomString(password.length));

        if (elapsed + cycleSpeed < randomPhaseDuration) {
            setTimeout(() => randomPhase(elapsed + cycleSpeed), cycleSpeed);
        } else {
            revealPhase(0, 0);
        }
    }

    function revealPhase(index, cycleIndex) {
        if (runId !== activeRunId) return;

        if (index >= password.length) {
            updatePassText(password);
            setTimeout(() => randomPhase(0), revealHoldDuration);
            return;
        }

        const targetChar = password[index];
        if (!charIndexMap.has(targetChar)) {
            updatePassText(buildRevealText(index, targetChar));
            setTimeout(() => revealPhase(index + 1, 0), cycleSpeed);
            return;
        }

        const currentChar = charCycleArray[cycleIndex];
        updatePassText(buildRevealText(index, currentChar));

        if (currentChar === targetChar) {
            setTimeout(() => revealPhase(index + 1, 0), cycleSpeed);
        } else {
            const nextIndex = (cycleIndex + 1) % charCycleArray.length;
            setTimeout(() => revealPhase(index, nextIndex), cycleSpeed);
        }
    }

    randomPhase();
}

startEffect();
export {startEffect};
