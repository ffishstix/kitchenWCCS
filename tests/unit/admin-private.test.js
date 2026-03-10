const {
    toNullableInt,
    toBit,
    parseDateOnly,
    parseIdList
} = require("../../admin/backEnd/server/private");

describe("admin private utils", () => {
    it("parses nullable integers", () => {
        expect(toNullableInt("12")).toBe(12);
        expect(toNullableInt(7)).toBe(7);
        expect(toNullableInt("abc")).toBeNull();
        expect(toNullableInt("")).toBeNull();
        expect(toNullableInt(null)).toBeNull();
    });

    it("parses boolean-ish values into bits", () => {
        expect(toBit(true)).toBe(1);
        expect(toBit("true")).toBe(1);
        expect(toBit(0)).toBe(0);
        expect(toBit("0")).toBe(0);
        expect(toBit("nope")).toBeNull();
    });

    it("parses date-only values with optional end-of-day", () => {
        const start = parseDateOnly("2025-01-02");
        const end = parseDateOnly("2025-01-02", true);
        expect(start.toISOString()).toBe("2025-01-02T00:00:00.000Z");
        expect(end.toISOString()).toBe("2025-01-02T23:59:59.999Z");
        expect(parseDateOnly("2025/01/02")).toBeNull();
    });

    it("parses id lists", () => {
        expect(parseIdList("1, 2, abc, 3")).toBe("1,2,3");
        expect(parseIdList(["4", "5", "x"])).toBe("4,5");
        expect(parseIdList("")).toBe("");
    });
});
