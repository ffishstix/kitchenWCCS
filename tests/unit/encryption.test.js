const hash = require("../../global/encryption.js");

describe("encryption module", () => {
    it("exports a callable hash function", () => {
        expect(typeof hash).toBe("function");
        expect(typeof hash.hash).toBe("function");
    });

    it("hash() matches hash.hash()", () => {
        const input = "test-input";
        expect(hash(input)).toBe(hash.hash(input));
    });
});
