import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { load } from "./index.ts";

const dir = mkdtempSync(join(tmpdir(), "vibator-config-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/**
 * Writes a config fixture and returns its path.
 *
 * @param name - The path of the fixture, relative to the fixture folder.
 * @param content - The JSON value, or the raw text to write.
 * @returns The absolute path of the fixture.
 */
function write(name: string, content: unknown): string {
  const path = join(dir, name);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(
    path,
    typeof content === "string" ? content : JSON.stringify(content),
  );
  return path;
}

describe("configuration.load", () => {
  it("parses a valid config", () => {
    const config = {
      $schema: "./schema.json",
      plugins: ["./rules/custom.ts"],
      exclude: ["vendor"],
      rules: {
        "no-deprecated-apis": "off",
        "meaningful-names": {
          severity: "warn",
          options: { minLength: 3 },
        },
      },
    };
    expect(load(write("valid.json", config))).toEqual(config);
  });

  it("returns an empty config when the file is absent", () => {
    expect(load(join(dir, "missing.json"))).toEqual({});
  });

  it("rejects an unknown top-level field", () => {
    expect(() => load(write("bad-field.json", { plugin: ["x"] }))).toThrow();
  });

  it("rejects an invalid severity", () => {
    expect(() =>
      load(write("bad-sev.json", { rules: { x: "sometimes" } })),
    ).toThrow();
  });

  it("rejects malformed JSON", () => {
    expect(() => load(write("malformed.json", "{ not json"))).toThrow();
  });
});

describe("configuration.load extends", () => {
  it("merges a base, the project winning per rule", () => {
    write("base.json", { rules: { a: "off", shared: "warn" } });
    const path = write("child.json", {
      extends: ["./base.json"],
      rules: { b: "warn", shared: "error" },
    });
    expect(load(path).rules).toEqual({
      a: "off",
      shared: { severity: "error" },
      b: "warn",
    });
  });

  it("merges a rule entry's severity and options by key", () => {
    write("base-options.json", {
      rules: { x: { severity: "warn", options: { min: 1, max: 5 } } },
    });
    const path = write("child-options.json", {
      extends: ["./base-options.json"],
      rules: { x: { options: { max: 9 } }, y: { severity: "warn" } },
    });
    write("child-shorthand.json", {
      extends: ["./base-options.json"],
      rules: { x: "off" },
    });
    expect(load(path).rules).toEqual({
      x: { severity: "warn", options: { min: 1, max: 9 } },
      y: { severity: "warn" },
    });
    expect(load(join(dir, "child-shorthand.json")).rules).toEqual({
      x: { severity: "off", options: { min: 1, max: 5 } },
    });
  });

  it("adds the project's plugins after the base's, once each", () => {
    write("plugins/base.json", { plugins: ["./a.ts", "./b.ts"] });
    const path = write("plugins/child.json", {
      extends: ["./base.json"],
      plugins: [join(dir, "plugins/b.ts"), "./c.ts"],
    });
    expect(load(path).plugins).toEqual([
      join(dir, "plugins/a.ts"),
      join(dir, "plugins/b.ts"),
      "./c.ts",
    ]);
  });

  it("resolves a base's plugins from the base file", () => {
    write("shared/vibator.json", { plugins: ["./rules.ts"] });
    const path = write("project/.vibator.json", {
      extends: ["../shared/vibator.json"],
    });
    expect(load(path).plugins).toEqual([join(dir, "shared/rules.ts")]);
  });

  it("loads a base from a package", () => {
    write("pkg/node_modules/@acme/config/package.json", {
      name: "@acme/config",
      exports: { "./vibator.json": "./vibator.json" },
    });
    write("pkg/node_modules/@acme/config/vibator.json", {
      plugins: ["./rules.ts"],
      rules: { x: "warn" },
    });
    const path = write("pkg/.vibator.json", {
      extends: ["@acme/config/vibator.json"],
    });
    expect(load(path)).toEqual({
      plugins: [join(dir, "pkg/node_modules/@acme/config/rules.ts")],
      rules: { x: "warn" },
    });
  });

  it("replaces exclude and keeps the project's $schema only", () => {
    write("exclude-base.json", { $schema: "./base.json", exclude: ["vendor"] });
    const path = write("exclude-child.json", {
      extends: ["./exclude-base.json"],
      exclude: ["generated"],
    });
    write("exclude-inherit.json", { extends: ["./exclude-base.json"] });
    expect(load(path)).toEqual({ exclude: ["generated"] });
    expect(load(join(dir, "exclude-inherit.json"))).toEqual({
      exclude: ["vendor"],
    });
  });

  it("applies bases in order, the later winning", () => {
    write("first.json", { rules: { x: "error" } });
    write("second.json", { rules: { x: "warn" } });
    const path = write("order.json", {
      extends: ["./first.json", "./second.json"],
    });
    expect(load(path).rules).toEqual({ x: { severity: "warn" } });
  });

  it("reads a base twice through two paths", () => {
    write("diamond/common.json", { rules: { x: "warn" } });
    write("diamond/left.json", { extends: ["./common.json"] });
    write("diamond/right.json", { extends: ["./common.json"] });
    const path = write("diamond/top.json", {
      extends: ["./left.json", "./right.json"],
    });
    expect(load(path).rules).toEqual({ x: { severity: "warn" } });
  });

  it("rejects a circular extends", () => {
    const path = write("loop-a.json", { extends: ["./loop-b.json"] });
    write("loop-b.json", { extends: ["./loop-a.json"] });
    expect(() => load(path)).toThrow(/circular extends/i);
  });
});

describe("configuration.load removed fields", () => {
  it("rejects a docs override in a rule entry", () => {
    expect(() =>
      load(write("docs.json", { rules: { x: { docs: "./x.md" } } })),
    ).toThrow();
  });
});
