/**
 * The `git` namespace: gateway to git functionality.
 *
 * @packageDocumentation
 */
import { execFileSync } from "node:child_process";
import { requireRoot } from "../runtime.ts";

const MAX_BUFFER = 512 * 1024 * 1024;

/**
 * The git status of one path.
 */
export interface StatusEntry {
  /** The repo-relative path. */
  readonly path: string;
  /** True when the path holds staged changes. */
  readonly staged: boolean;
  /** True when the path holds unstaged changes. */
  readonly unstaged: boolean;
  /** True when git tracks the path for the first time. */
  readonly untracked: boolean;
}

/**
 * Runs a git command from the project root and returns its trimmed output.
 *
 * @param args - The arguments passed to git.
 * @returns The trimmed standard output.
 */
function output(args: string[]): string {
  return execFileSync("git", args, {
    cwd: requireRoot(),
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * Runs a git command whose output is a NUL-separated path list.
 *
 * @param args - The arguments passed to git.
 * @returns The paths git printed.
 */
function paths(args: string[]): string[] {
  return execFileSync("git", args, {
    cwd: requireRoot(),
    encoding: "buffer",
    maxBuffer: MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
  })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

/**
 * Gateway to git functionality.
 */
export const git = {
  /**
   * Reports whether the project root sits inside a git repository.
   *
   * @returns Whether the root sits inside a git repository.
   */
  isRepo(): boolean {
    try {
      return output(["rev-parse", "--is-inside-work-tree"]) === "true";
    } catch {
      return false;
    }
  },

  /**
   * The tracked and untracked-not-ignored paths git keeps.
   *
   * @returns The repo-relative paths.
   */
  files(): string[] {
    return paths([
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
    ]);
  },

  /**
   * The untracked paths git keeps.
   *
   * @returns The repo-relative paths.
   */
  untrackedFiles(): string[] {
    return paths(["ls-files", "-z", "--others", "--exclude-standard"]);
  },

  /**
   * The paths this working tree changed against `HEAD`, present on disk.
   *
   * @returns The repo-relative paths.
   */
  changedFiles(): string[] {
    const changed = paths([
      "diff",
      "--name-only",
      "--diff-filter=d",
      "-z",
      "HEAD",
    ]);
    return [...new Set([...changed, ...this.untrackedFiles()])];
  },

  /**
   * The paths staged for the next commit, present on disk.
   *
   * @returns The repo-relative paths.
   */
  stagedFiles(): string[] {
    return paths(["diff", "--name-only", "--cached", "--diff-filter=d", "-z"]);
  },

  /**
   * The paths this branch changed since it diverged from `base`.
   *
   * @param base - The ref to diff against.
   * @returns The repo-relative paths.
   */
  changedSince(base: string): string[] {
    if (base.startsWith("-")) {
      throw new Error(`refusing a git ref that looks like an option: ${base}`);
    }
    return paths([
      "diff",
      "--name-only",
      "--diff-filter=d",
      "-z",
      "--end-of-options",
      `${base}...HEAD`,
    ]);
  },

  /**
   * The working-tree status of the given paths.
   *
   * @param pathsToCheck - The repo-relative paths to inspect.
   * @returns One status entry per changed path.
   */
  status(pathsToCheck: string[]): StatusEntry[] {
    const report = execFileSync(
      "git",
      ["status", "--porcelain", "--", ...pathsToCheck],
      { cwd: requireRoot(), encoding: "utf8", maxBuffer: MAX_BUFFER },
    );
    return report
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => {
        const code = line.slice(0, 2);
        return {
          path: line.slice(3),
          staged: code[0] !== " " && code[0] !== "?",
          unstaged: code[1] !== " " && code[1] !== "?",
          untracked: code === "??",
        };
      });
  },

  /**
   * Restores the given tracked paths from the index.
   *
   * @param pathsToRestore - The repo-relative paths to restore.
   */
  restore(pathsToRestore: string[]): void {
    output(["checkout", "--", ...pathsToRestore]);
  },
};
