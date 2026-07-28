import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { load } from "./index.ts";

const dir = mkdtempSync(join(tmpdir(), "vibator-config-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Writes a config fixture and returns its path. */
function write(name: string, content: unknown): string {
  const path = join(dir, name);
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
          docs: ".vibator/docs/x.md",
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
  it("merges a base config, the child winning and arrays replacing", () => {
    write("base.json", {
      plugins: ["base-plugin"],
      rules: { a: "off", shared: "warn" },
    });
    const path = write("child.json", {
      extends: ["./base.json"],
      plugins: ["child-plugin"],
      rules: { b: "warn", shared: "off" },
    });
    expect(load(path)).toEqual({
      plugins: ["child-plugin"],
      rules: { a: "off", shared: "off", b: "warn" },
    });
  });

  it("deep-merges rule options", () => {
    write("base-opts.json", {
      rules: { x: { severity: "warn", options: { min: 1 } } },
    });
    const path = write("child-opts.json", {
      extends: ["./base-opts.json"],
      rules: { x: { options: { max: 9 } } },
    });
    expect(load(path)).toEqual({
      rules: { x: { severity: "warn", options: { min: 1, max: 9 } } },
    });
  });

  it("applies bases in order, the later winning", () => {
    write("b1.json", { rules: { x: "error" } });
    write("b2.json", { rules: { x: "warn" } });
    const path = write("chain.json", { extends: ["./b1.json", "./b2.json"] });
    expect(load(path)).toEqual({ rules: { x: "warn" } });
  });

  it("rejects a circular extends", () => {
    const path = write("loop-a.json", { extends: ["./loop-b.json"] });
    write("loop-b.json", { extends: ["./loop-a.json"] });
    expect(() => load(path)).toThrow(/circular/i);
  });
});
