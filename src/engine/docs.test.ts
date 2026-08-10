import { describe, expect, it } from "vitest";
import { resolveDocs } from "./docs.ts";

describe("resolveDocs", () => {
  it("resolves a plain path from the project root", () => {
    expect(resolveDocs(".vibator/docs/my-rule.md", "/abs/project")).toBe(
      "/abs/project/.vibator/docs/my-rule.md",
    );
  });

  it("resolves a package-prefixed path from the package root", () => {
    const path = resolveDocs("zod:README.md", "/abs/project");
    expect(path).toMatch(/node_modules\/zod\/README\.md$/);
  });

  it("resolves a scoped-package-prefixed path from the package root", () => {
    const path = resolveDocs("@types/node:README.md", "/abs/project");
    expect(path).toMatch(/node_modules\/@types\/node\/README\.md$/);
  });

  it("throws when the prefixed package is not installed", () => {
    expect(() => resolveDocs("no-such-package:docs/rule.md", "/abs")).toThrow();
  });
});
