import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { module } from "./index.ts";

const anchor = fileURLToPath(import.meta.url);

describe("module.resolve", () => {
  it("resolves a relative path against the from file", () => {
    expect(module.resolve("./a.ts", "/proj/config.json")).toBe(
      resolve("/proj", "./a.ts"),
    );
  });

  it("keeps an absolute path", () => {
    expect(module.resolve("/abs/a.ts", "/proj/config.json")).toBe("/abs/a.ts");
  });

  it("resolves a package to an absolute file", () => {
    const resolved = module.resolve("zod", anchor);
    expect(isAbsolute(resolved)).toBe(true);
    expect(resolved).toContain("zod");
  });
});
