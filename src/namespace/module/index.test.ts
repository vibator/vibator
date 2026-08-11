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

  it("resolves a dot path the same, without the ./ prefix", () => {
    expect(module.resolve(".vibator/biome.json", "/proj/config.json")).toBe(
      resolve("/proj", ".vibator/biome.json"),
    );
  });

  it("keeps an absolute path", () => {
    expect(module.resolve("/abs/a.ts", "/proj/config.json")).toBe("/abs/a.ts");
  });

  it("resolves a package export to an absolute file", () => {
    const resolved = module.resolve("zod", anchor);
    expect(isAbsolute(resolved)).toBe(true);
    expect(resolved).toContain("zod");
  });

  it("resolves a package:path reference to a file inside the package", () => {
    const path = module.resolve("zod:README.md", anchor);
    expect(path).toMatch(/node_modules\/zod\/README\.md$/);
  });

  it("resolves a scoped package:path reference the same", () => {
    const path = module.resolve("@types/node:README.md", anchor);
    expect(path).toMatch(/node_modules\/@types\/node\/README\.md$/);
  });

  it("throws when a package:path names an uninstalled package", () => {
    expect(() => module.resolve("no-such-package:x.md", anchor)).toThrow(
      /no-such-package/,
    );
  });

  it("treats a dotless relative path as a package and hints the ./ prefix", () => {
    expect(() => module.resolve("fixtures/biome.json", anchor)).toThrow(
      /starts with "\.\/"/,
    );
  });

  it("hints the ./ prefix for a bare file name", () => {
    expect(() => module.resolve("biome.json", anchor)).toThrow(
      /starts with "\.\/"/,
    );
  });

  it("keeps the plain error for a bare package name", () => {
    expect(() => module.resolve("no-such-package", anchor)).toThrow(
      /no-such-package/,
    );
    expect(() => module.resolve("no-such-package", anchor)).not.toThrow(
      /starts with "\.\/"/,
    );
  });
});
