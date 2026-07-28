import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { File } from "../project/index.ts";
import { setRoot } from "../runtime.ts";
import { pkg } from "./index.ts";

const dir = mkdtempSync(join(tmpdir(), "vibator-package-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;

/** Writes package content to a temp file and returns the File over it. */
function fileOf(content: string): File {
  const path = join(dir, `pkg${counter++}.json`);
  writeFileSync(path, content);
  return new File(path);
}

describe("package.parse", () => {
  it("parses the standard fields", () => {
    const manifest = pkg.parse(
      fileOf(
        JSON.stringify({
          name: "acme",
          version: "1.2.3",
          scripts: { build: "tsc" },
          dependencies: { zod: "^4" },
          devDependencies: { vitest: "^4" },
          peerDependencies: { typescript: "^6" },
        }),
      ),
    );
    expect(manifest).toEqual({
      name: "acme",
      version: "1.2.3",
      scripts: { build: "tsc" },
      dependencies: { zod: "^4" },
      devDependencies: { vitest: "^4" },
      peerDependencies: { typescript: "^6" },
    });
  });

  it("defaults missing fields", () => {
    expect(pkg.parse(fileOf("{}"))).toEqual({
      name: "",
      version: "",
      scripts: {},
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
    });
  });
});

describe("package.root", () => {
  it("reads and parses the root package.json", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "root-pkg", version: "0.1.0" }),
    );
    setRoot(dir);
    expect(pkg.root.name).toBe("root-pkg");
    expect(pkg.root.version).toBe("0.1.0");
  });
});
