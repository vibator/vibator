/**
 * File discovery, shared across rules.
 *
 * @packageDocumentation
 */
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";
import { join, matchesGlob, relative } from "node:path";

/** Directories never worth walking, whatever a rule's globs say. */
const ALWAYS_EXCLUDED = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.git/**",
];

/** The candidate file set per root, computed once per run. */
const universeCache = new Map<string, string[]>();

/**
 * Every file git would keep: tracked, plus untracked but not ignored.
 *
 * @remarks Deferring to git is what keeps generated output out of the results.
 * A repo's `.gitignore` already states which files are not the project's own —
 * build artifacts, native shells, vendored bundles — and a glob walk that
 * ignores it reports findings about files nobody wrote and nobody can fix.
 * @param root - Absolute project root.
 * @returns Repo-relative paths, or `undefined` outside a git repository.
 */
function gitUniverse(root: string): string[] | undefined {
  const cached = universeCache.get(root);
  if (cached) return cached;

  try {
    const listed = execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      {
        cwd: root,
        encoding: "buffer",
        maxBuffer: 512 * 1024 * 1024,
        // Outside a repository git writes to stderr and exits non-zero; the
        // fallback handles that, so the message is noise rather than news.
        stdio: ["ignore", "pipe", "ignore"],
      },
    )
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
    universeCache.set(root, listed);
    return listed;
  } catch {
    return undefined;
  }
}

/**
 * Every file under the root, when git cannot answer.
 *
 * @param root - Absolute project root.
 * @returns Repo-relative paths of regular files.
 */
function globUniverse(root: string): string[] {
  return globSync("**/*", {
    cwd: root,
    exclude: ALWAYS_EXCLUDED,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)));
}

/**
 * Runs git and splits its NUL-separated output into paths.
 *
 * @param root - Absolute project root.
 * @param arguments_ - The git arguments after the binary.
 * @returns The listed paths.
 */
function gitPaths(root: string, arguments_: string[]): string[] {
  return execFileSync("git", arguments_, {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

/**
 * The files a change-scoped run should judge.
 *
 * @remarks Always the uncommitted work — staged, unstaged and untracked — and,
 * when a base is given, everything the current branch changed since diverging
 * from it. Deleted files are excluded: a gate cannot judge what no longer
 * exists. This is the principled alternative to a baseline file — a legacy
 * codebase gates its new work immediately without recording its old debt as
 * acceptable.
 * @param root - Absolute project root.
 * @param base - A ref to diff against, such as `origin/main`.
 * @returns Repo-relative paths of changed files.
 * @throws When git cannot answer — outside a repository, or on an unknown ref.
 */
export function changedFiles(root: string, base?: string): Set<string> {
  const sinceBase = base
    ? gitPaths(root, [
        "diff",
        "--name-only",
        "--diff-filter=d",
        "-z",
        `${base}...HEAD`,
      ])
    : [];

  return new Set(
    [...uncommittedPaths(root), ...sinceBase].map((path) =>
      path.replaceAll("\\", "/"),
    ),
  );
}

/**
 * The paths of every uncommitted change — staged, unstaged and untracked.
 *
 * @param root - Absolute project root.
 * @returns Repo-relative paths, deleted files excluded.
 */
function uncommittedPaths(root: string): string[] {
  return [
    ...gitPaths(root, ["diff", "--name-only", "--diff-filter=d", "-z", "HEAD"]),
    ...gitPaths(root, ["ls-files", "-z", "--others", "--exclude-standard"]),
  ];
}

/**
 * The files staged for the next commit.
 *
 * @remarks The commit-time scope: what `git commit` would actually record,
 * nothing else — an unstaged edit or an untracked scratch file is not this
 * commit's problem. Judged from the working tree's content, so a file that is
 * partially staged is checked as it stands on disk, the same convention
 * staged-mode formatters follow.
 * @param root - Absolute project root.
 * @returns Repo-relative paths, deleted files excluded.
 * @throws When git cannot answer — outside a repository, for instance.
 */
export function stagedFiles(root: string): Set<string> {
  const staged = gitPaths(root, [
    "diff",
    "--name-only",
    "--cached",
    "--diff-filter=d",
    "-z",
  ]);
  return new Set(staged.map((path) => path.replaceAll("\\", "/")));
}

/**
 * Selects the files a rule should judge.
 *
 * @remarks Results are sorted so a run is reproducible and two runs diff
 * cleanly. Discovery is deliberately separate from analysis: knowing the file
 * count up front is what lets the reporter show real progress rather than a
 * spinner that means nothing.
 * @param root - Absolute project root.
 * @param include - Globs selecting files.
 * @param exclude - Globs removing files from that selection.
 * @returns Repo-relative paths, sorted, each appearing once.
 */
export function discover(
  root: string,
  include: string[],
  exclude: string[],
): string[] {
  if (include.length === 0) return [];

  const universe = gitUniverse(root) ?? globUniverse(root);
  const excludes = [...ALWAYS_EXCLUDED, ...exclude];

  const kept = universe
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => include.some((pattern) => matchesGlob(path, pattern)))
    .filter((path) => !excludes.some((pattern) => matchesGlob(path, pattern)));

  return [...new Set(kept)].sort((left, right) => left.localeCompare(right));
}
