import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createContext } from "../core/context.ts";
import { envExampleSync } from "./env-example-sync.ts";

/** The rule's options with every default applied. */
const defaults = envExampleSync.optionsSchema.parse({});

/**
 * Runs the rule over one source file and one example file.
 *
 * @param source - The source file's contents.
 * @param example - The example file's contents, or nothing for no file.
 * @returns The diagnostics produced.
 */
async function run(source: string, example?: string) {
  const root = mkdtempSync(join(tmpdir(), "vibator-"));
  writeFileSync(join(root, "app.ts"), source);
  if (example !== undefined) writeFileSync(join(root, ".env.example"), example);

  const { context } = createContext(root);
  return await envExampleSync.check({
    files: ["app.ts"],
    options: defaults,
    context,
  });
}

describe("env-example-sync", () => {
  it("catches a variable read through destructuring", async () => {
    const found = await run(
      "const { DATABASE_URL } = process.env;\n",
      "# nothing here\n",
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("DATABASE_URL");
  });

  it("counts renamed and defaulted destructured names", async () => {
    const found = await run(
      'const { API_URL: base, PORT = "3000" } = process.env;\n',
      "API_URL=http://localhost\nPORT=3000\n",
    );
    expect(found).toEqual([]);
  });

  it("ignores lowercase bindings in a destructuring list", async () => {
    const found = await run(
      "const { env } = process;\nconst { config } = env;\n",
      "",
    );
    expect(found).toEqual([]);
  });

  it("catches Deno and Bun reads", async () => {
    const found = await run(
      'const key = Deno.env.get("API_KEY");\nconst port = Bun.env.PORT;\n',
      "",
    );
    expect(found.map((entry) => entry.message).join(" ")).toContain("API_KEY");
    expect(found.map((entry) => entry.message).join(" ")).toContain("PORT");
  });

  it("still accepts a documented direct read", async () => {
    const found = await run(
      "const url = process.env.SERVICE_URL;\n",
      "SERVICE_URL=https://example.com\n",
    );
    expect(found).toEqual([]);
  });
});
