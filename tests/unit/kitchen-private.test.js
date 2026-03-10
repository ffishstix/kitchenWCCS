const {state} = require("../../kitchen/backEnd/server/state");
const {
    getMaxOrderLineId,
    listsMatch,
    resolveOrderActiveAt
} = require("../../kitchen/backEnd/server/private");

describe("kitchen private utils", () => {
    it("returns the max order line id", () => {
        const items = [{orderLineId: 2}, {orderLineId: 9}, {orderLineId: "7"}];
        expect(getMaxOrderLineId(items, 3)).toBe(9);
        expect(getMaxOrderLineId([], 5)).toBe(5);
    });

    it("compares lists by order keys", () => {
        const itemsA = [{orderLineId: 1}, {orderLineId: 2}];
        const itemsB = [{orderLineId: 2}, {orderLineId: 1}];
        const itemsC = [{orderLineId: 3}];
        expect(listsMatch(itemsA, itemsB)).toBe(true);
        expect(listsMatch(itemsA, itemsC)).toBe(false);
    });

    it("uses unfinish override for active timestamp", () => {
        state.unfinishOverrides.set(101, 1700000000000);
        const resolved = resolveOrderActiveAt(101, "2024-01-01T00:00:00Z");
        expect(resolved).toBe(new Date(1700000000000).toISOString());
        state.unfinishOverrides.delete(101);
    });
});
