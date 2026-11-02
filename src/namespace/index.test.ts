import { afterEach, describe, expect, it } from "vitest";
import { defineNamespace, vibator } from "./index.ts";

/** The namespaces these tests add, removed after each test. */
const added = ["audit", "other"];

afterEach(() => {
  for (const name of added) Reflect.deleteProperty(vibator, name);
});

describe("defineNamespace", () => {
  it("adds a namespace to vibator and returns it", () => {
    const audit = { count: () => 3 };
    expect(defineNamespace("audit", audit)).toBe(audit);
    expect(Reflect.get(vibator, "audit")).toBe(audit);
  });

  it("rejects a name a built-in namespace uses", () => {
    expect(() => defineNamespace("text", {})).toThrow(
      /Duplicate namespace: text/,
    );
  });

  it("rejects a name a plugin already added", () => {
    defineNamespace("other", {});
    expect(() => defineNamespace("other", {})).toThrow(
      /Duplicate namespace: other/,
    );
  });
});
