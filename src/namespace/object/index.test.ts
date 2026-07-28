import { describe, expect, it } from "vitest";
import { object } from "./index.ts";

describe("object.merge", () => {
  it("deep-merges nested objects, the override winning", () => {
    expect(
      object.merge({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 20 }, e: 4 }),
    ).toEqual({ a: 1, b: { c: 20, d: 3 }, e: 4 });
  });

  it("replaces arrays with the override", () => {
    expect(object.merge({ list: [1, 2, 3] }, { list: [9] })).toEqual({
      list: [9],
    });
  });

  it("replaces scalars with the override", () => {
    expect(object.merge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("returns the override when either side is not a plain object", () => {
    expect(object.merge([1, 2], [3])).toEqual([3]);
  });

  it("ignores __proto__ to avoid prototype pollution", () => {
    const result = object.merge<Record<string, unknown>>(
      {},
      JSON.parse('{ "__proto__": { "polluted": true } }'),
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
});
