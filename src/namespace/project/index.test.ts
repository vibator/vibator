import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setRoot } from "../runtime.ts";
import { project } from "./index.ts";

/** Sorted repo-relative paths, for comparing regardless of the tmp prefix. */
function rels(dir: string, paths: string[]): string[] {
  return paths.map((path) => relative(dir, path)).sort();
}

describe("project with a git repository", () => {
  const dir = mkdtempSync(join(tmpdir(), "vibator-project-"));

  const git = (...args: string[]): void => {
    execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  };

  beforeAll(() => {
    git("init");
    writeFileSync(join(dir, ".gitignore"), "*.log\n");
    writeFileSync(join(dir, "a.ts"), "export const a = 1;");
    writeFileSync(join(dir, "b.ts"), "export const b = 2;");
    mkdirSync(join(dir, "src", "sub"), { recursive: true });
    writeFileSync(join(dir, "src", "c.ts"), "export const c = 3;");
    writeFileSync(join(dir, "src", "sub", "e.ts"), "export const e = 5;");
    writeFileSync(join(dir, "ignoreme.log"), "noise");
    writeFileSync(join(dir, "untracked.txt"), "u");
    git("add", ".gitignore", "a.ts", "b.ts", "src/c.ts", "src/sub/e.ts");
    setRoot(dir);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("exposes the absolute root", () => {
    expect(project.root).toBe(dir);
  });

  it("lists tracked and untracked-not-ignored files", () => {
    expect(rels(dir, project.files.paths())).toEqual([
      ".gitignore",
      "a.ts",
      "b.ts",
      "src/c.ts",
      "src/sub/e.ts",
      "untracked.txt",
    ]);
  });

  it("counts the files", () => {
    expect(project.files.length).toBe(6);
  });

  it("filters by glob", () => {
    expect(rels(dir, project.files.match("**/*.ts").paths())).toEqual([
      "a.ts",
      "b.ts",
      "src/c.ts",
      "src/sub/e.ts",
    ]);
  });

  it("chains a negated glob", () => {
    expect(
      rels(dir, project.files.match("**/*.ts").match("!src/**").paths()),
    ).toEqual(["a.ts", "b.ts"]);
  });

  it("reads a file by absolute path", () => {
    const file = project.files.get(join(dir, "a.ts"));
    expect(file.content).toBe("export const a = 1;");
    expect(file.name).toBe("a.ts");
    expect(file.ext).toBe(".ts");
    expect(file.bytes.length).toBe(file.content.length);
  });

  it("lists the top-level folders", () => {
    expect(rels(dir, project.folders.paths())).toEqual(["src"]);
  });

  it("exposes a folder's direct files and subfolders", () => {
    const src = project.folders.get(join(dir, "src"));
    expect(rels(dir, src?.files.paths() ?? [])).toEqual(["src/c.ts"]);
    expect(rels(dir, src?.folders.paths() ?? [])).toEqual(["src/sub"]);
  });

  it("writes a new file, creating parent directories", () => {
    project.write(join(dir, "generated", "w.txt"), "hi");
    expect(readFileSync(join(dir, "generated", "w.txt"), "utf8")).toBe("hi");
  });

  it("overwrites an existing file", () => {
    project.write(join(dir, "generated", "w.txt"), "bye");
    expect(readFileSync(join(dir, "generated", "w.txt"), "utf8")).toBe("bye");
  });
});

describe("project without a git repository", () => {
  const dir = mkdtempSync(join(tmpdir(), "vibator-plain-"));

  beforeAll(() => {
    writeFileSync(join(dir, "x.ts"), "x");
    mkdirSync(join(dir, "lib"), { recursive: true });
    writeFileSync(join(dir, "lib", "y.ts"), "y");
    setRoot(dir);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("falls back to a filesystem walk", () => {
    expect(rels(dir, project.files.paths())).toEqual(["lib/y.ts", "x.ts"]);
  });
});
