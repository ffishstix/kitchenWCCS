const hash = require("../../global/encryption.js");

function buildCredentialHash(username, password) {
    return hash(String(username || "") + String(password || ""));
}

module.exports = {buildCredentialHash};
