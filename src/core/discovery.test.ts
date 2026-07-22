import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { changedFiles, discover, stagedFiles } from "./discovery.ts";

/**
 * Builds a throwaway project tree.
 *
 * @param files - Repo-relative paths to create.
 * @returns The absolute root of the new tree.
 */
function projectWith(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "vibator-"));
  files.forEach((file) => {
    const full = join(root, file);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, "content\n");
  });
  return root;
}

describe("discover", () => {
  it("selects files matching the include globs", () => {
    const root = projectWith(["src/a.ts", "src/b.tsx", "README.md"]);
    expect(discover(root, ["src/**/*.ts"], [])).toEqual(["src/a.ts"]);
  });

  it("removes files matching the exclude globs", () => {
    const root = projectWith(["src/a.ts", "src/a.test.ts"]);
    expect(discover(root, ["src/**/*.ts"], ["**/*.test.ts"])).toEqual([
      "src/a.ts",
    ]);
  });

  it("never walks node_modules", () => {
    const root = projectWith(["src/a.ts", "node_modules/pkg/index.ts"]);
    expect(discover(root, ["**/*.ts"], [])).toEqual(["src/a.ts"]);
  });

  it("returns nothing when no globs are configured", () => {
    const root = projectWith(["src/a.ts"]);
    expect(discover(root, [], [])).toEqual([]);
  });

  it("sorts results so runs are reproducible", () => {
    const root = projectWith(["src/z.ts", "src/a.ts", "src/m.ts"]);
    expect(discover(root, ["src/*.ts"], [])).toEqual([
      "src/a.ts",
      "src/m.ts",
      "src/z.ts",
    ]);
  });

  it("finds files inside dot-directories", () => {
    // Glob convention keeps ** from crossing dot-segments; a conflict marker
    // in a workflow file must still be found.
    const root = projectWith([".github/workflows/ci.yml", ".github/notes.md"]);
    expect(discover(root, ["**/*"], [])).toContain(".github/workflows/ci.yml");
    expect(discover(root, ["**/*.md"], [])).toContain(".github/notes.md");
  });

  it("still honours explicit dot-directory patterns and excludes", () => {
    const root = projectWith([".github/notes.md", "docs/notes.md"]);
    expect(discover(root, [".github/**"], [])).toEqual([".github/notes.md"]);
    expect(discover(root, ["**/*.md"], [".github/**"])).toEqual([
      "docs/notes.md",
    ]);
  });
});

describe("changedFiles", () => {
  /**
   * Builds a throwaway git repository with one committed file.
   *
   * @returns The repository root.
   */
  function repositoryWith(): string {
    const root = projectWith(["committed.ts"]);
    const git = (args: string) =>
      execSync(`git ${args}`, { cwd: root, stdio: "pipe" });
    git("init -q -b main");
    git("config user.email test@example.com");
    git("config user.name test");
    git("add .");
    git("commit -qm initial");
    return root;
  }

  it("collects modified and untracked files, not clean ones", () => {
    const root = repositoryWith();
    writeFileSync(join(root, "committed.ts"), "changed\n");
    writeFileSync(join(root, "fresh.ts"), "new\n");

    const changed = changedFiles(root);
    expect(changed.has("committed.ts")).toBe(true);
    expect(changed.has("fresh.ts")).toBe(true);
  });

  it("returns an empty set for a clean tree", () => {
    expect(changedFiles(repositoryWith()).size).toBe(0);
  });

  it("includes commits since a base ref", () => {
    const root = repositoryWith();
    execSync("git checkout -qb feature", { cwd: root, stdio: "pipe" });
    writeFileSync(join(root, "committed.ts"), "on the branch\n");
    execSync("git commit -aqm change", { cwd: root, stdio: "pipe" });

    expect(changedFiles(root).has("committed.ts")).toBe(false);
    expect(changedFiles(root, "main").has("committed.ts")).toBe(true);
  });

  it("throws on an unknown base ref rather than judging nothing", () => {
    expect(() => changedFiles(repositoryWith(), "no-such-ref")).toThrow();
  });

  it("keeps staged and merely-changed scopes distinct", () => {
    const root = repositoryWith();
    writeFileSync(join(root, "committed.ts"), "edited but not staged\n");
    writeFileSync(join(root, "staged.ts"), "new and staged\n");
    execSync("git add staged.ts", { cwd: root, stdio: "pipe" });

    const staged = stagedFiles(root);
    expect(staged.has("staged.ts")).toBe(true);
    expect(staged.has("committed.ts")).toBe(false);

    const changed = changedFiles(root);
    expect(changed.has("staged.ts")).toBe(true);
    expect(changed.has("committed.ts")).toBe(true);
  });
});
