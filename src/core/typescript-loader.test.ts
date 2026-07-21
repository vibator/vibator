import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { loadTypeScript } from "./typescript-loader.ts";

describe("loadTypeScript", () => {
  it("prefers the copy the project itself provides", async () => {
    const root = mkdtempSync(join(tmpdir(), "vibator-"));
    const fake = join(root, "node_modules", "typescript");
    mkdirSync(fake, { recursive: true });
    writeFileSync(
      join(fake, "package.json"),
      JSON.stringify({
        name: "typescript",
        version: "0.0.0-fake",
        main: "index.js",
      }),
    );
    writeFileSync(
      join(fake, "index.js"),
      "module.exports = { version: '0.0.0-fake' };\n",
    );

    const loaded = await loadTypeScript(root);
    expect(loaded.version).toBe("0.0.0-fake");
  });

  it("falls back to a resolvable copy when the project has none", async () => {
    const root = mkdtempSync(join(tmpdir(), "vibator-"));
    const loaded = await loadTypeScript(root);
    expect(loaded.version).toBe(ts.version);
  });
});
