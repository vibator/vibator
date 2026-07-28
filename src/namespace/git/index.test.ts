import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setRoot } from "../runtime.ts";
import { git } from "./index.ts";

const dir = mkdtempSync(join(tmpdir(), "vibator-git-"));
let firstSha = "";

/** Runs git in the fixture directory and returns its trimmed output. */
function run(...args: string[]): string {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
}

beforeAll(() => {
  run("init");
  run("config", "user.email", "test@example.com");
  run("config", "user.name", "Test");
  writeFileSync(join(dir, "a.ts"), "1");
  run("add", "a.ts");
  run("commit", "-m", "init");
  firstSha = run("rev-parse", "HEAD");
  writeFileSync(join(dir, "d.ts"), "d");
  run("add", "d.ts");
  run("commit", "-m", "second");
  writeFileSync(join(dir, "a.ts"), "2"); // unstaged modification
  writeFileSync(join(dir, "b.ts"), "b");
  run("add", "b.ts"); // staged new file
  writeFileSync(join(dir, "c.txt"), "c"); // untracked
  setRoot(dir);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("git", () => {
  it("reports it is a repository", () => {
    expect(git.isRepo()).toBe(true);
  });

  it("lists tracked and untracked-not-ignored files", () => {
    expect(git.files().sort()).toEqual(["a.ts", "b.ts", "c.txt", "d.ts"]);
  });

  it("lists untracked files", () => {
    expect(git.untrackedFiles()).toEqual(["c.txt"]);
  });

  it("lists staged files", () => {
    expect(git.stagedFiles()).toEqual(["b.ts"]);
  });

  it("lists changed files", () => {
    expect(git.changedFiles().sort()).toEqual(["a.ts", "b.ts", "c.txt"]);
  });

  it("lists files changed since a ref", () => {
    expect(git.changedSince(firstSha)).toEqual(["d.ts"]);
  });

  it("reports the status of paths", () => {
    const status = git.status(["a.ts", "b.ts", "c.txt"]);
    const byPath = Object.fromEntries(
      status.map((entry) => [entry.path, entry]),
    );
    expect(byPath["a.ts"]).toMatchObject({
      staged: false,
      unstaged: true,
      untracked: false,
    });
    expect(byPath["b.ts"]).toMatchObject({
      staged: true,
      unstaged: false,
      untracked: false,
    });
    expect(byPath["c.txt"]).toMatchObject({ untracked: true });
  });

  it("restores a tracked path", () => {
    git.restore(["a.ts"]);
    expect(readFileSync(join(dir, "a.ts"), "utf8")).toBe("1");
  });
});

describe("git outside a repository", () => {
  const plain = mkdtempSync(join(tmpdir(), "vibator-nogit-"));

  beforeAll(() => setRoot(plain));
  afterAll(() => rmSync(plain, { recursive: true, force: true }));

  it("reports it is not a repository", () => {
    expect(git.isRepo()).toBe(false);
  });
});
