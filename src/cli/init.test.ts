import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { packageManifest } from "../core/package-root.ts";
import { BUILT_IN_RULES } from "../rules/index.ts";
import { init } from "./init.ts";

/**
 * Runs init in a fresh directory with console output captured.
 *
 * @param prepare - Mutates the directory before init runs.
 * @returns The directory and the captured log lines.
 */
function runInit(prepare: (root: string) => void = () => {}): {
  root: string;
  logged: string[];
} {
  const root = mkdtempSync(join(tmpdir(), "vibator-"));
  prepare(root);
  const logged: string[] = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    logged.push(String(line));
  });
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    logged.push(String(line));
  });
  init(root, BUILT_IN_RULES);
  return { root, logged };
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("init", () => {
  it("writes a starter config with a schema reference", () => {
    const { root, logged } = runInit();
    const written = JSON.parse(
      readFileSync(join(root, "vibator.json"), "utf8"),
    );
    expect(written.$schema).toBeTruthy();
    expect(written.rules).toEqual({});
    expect(logged.join("\n")).toContain("locale-parity");
  });

  it("points $schema at node_modules when the schema resolves there", () => {
    const { name } = packageManifest();
    const { root } = runInit((directory) => {
      mkdirSync(join(directory, "node_modules", name), { recursive: true });
      writeFileSync(join(directory, "node_modules", name, "schema.json"), "{}");
    });
    const written = JSON.parse(
      readFileSync(join(root, "vibator.json"), "utf8"),
    );
    expect(written.$schema).toBe(`./node_modules/${name}/schema.json`);
  });

  it("falls back to the published schema URL otherwise", () => {
    const { root } = runInit();
    const written = JSON.parse(
      readFileSync(join(root, "vibator.json"), "utf8"),
    );
    expect(written.$schema).toMatch(
      /^https:\/\/unpkg\.com\/.+@\d+\.\d+\.\d+\/schema\.json$/,
    );
  });

  it("refuses to overwrite an existing config", () => {
    const { root, logged } = runInit((directory) => {
      writeFileSync(join(directory, "vibator.json"), '{"rules": {}}');
    });
    expect(logged.join("\n")).toContain("already exists");
    expect(process.exitCode).toBe(1);
    expect(readFileSync(join(root, "vibator.json"), "utf8")).toBe(
      '{"rules": {}}',
    );
  });
});
