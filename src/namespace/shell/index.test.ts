import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setRoot } from "../runtime.ts";
import { shell } from "./index.ts";

const dir = mkdtempSync(join(tmpdir(), "vibator-shell-"));

beforeAll(() => {
  mkdirSync(join(dir, "sub"), { recursive: true });
  writeFileSync(join(dir, "sub", "f.txt"), "content");
  setRoot(dir);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("shell.run", () => {
  it("runs a command and captures stdout", () => {
    const result = shell.run("echo hello", {});
    expect(result.ok).toBe(true);
    expect(result.stdout.trim()).toBe("hello");
    expect(result.code).toBe(0);
  });

  it("reports a failing command with its exit code", () => {
    const result = shell.run("exit 3", {});
    expect(result.ok).toBe(false);
    expect(result.code).toBe(3);
  });

  it("captures stderr", () => {
    const result = shell.run("echo oops 1>&2", {});
    expect(result.stderr.trim()).toBe("oops");
  });

  it("runs in a working directory relative to the root", () => {
    const result = shell.run("cat f.txt", { cwd: "sub" });
    expect(result.stdout).toBe("content");
  });
});
