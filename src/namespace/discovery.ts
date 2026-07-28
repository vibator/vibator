/**
 * File discovery for the namespace.
 *
 * @packageDocumentation
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { excludedDirectories, scopedFiles } from "./runtime.ts";

const MAX_BUFFER = 512 * 1024 * 1024;

/**
 * The tracked and untracked-not-ignored files git keeps.
 *
 * @param root - The absolute project root.
 * @returns Repo-relative paths, or undefined outside a git repository.
 */
function gitFiles(root: string): string[] | undefined {
  try {
    return execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      {
        cwd: root,
        encoding: "buffer",
        maxBuffer: MAX_BUFFER,
        stdio: ["ignore", "pipe", "ignore"],
      },
    )
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
  } catch {
    return undefined;
  }
}

/**
 * Every regular file under the root, skipping the excluded directories.
 *
 * @param root - The absolute project root.
 * @param skip - Directory names to skip, defaulting to the configured excludes.
 * @returns Repo-relative paths.
 */
function walkFiles(
  root: string,
  skip: ReadonlySet<string> = excludedDirectories(),
): string[] {
  const found: string[] = [];
  visitDirectory(root, root, skip, found);
  return found;
}

/**
 * Recurses into a directory, collecting the repo-relative paths of its files.
 *
 * @param dir - The absolute directory to walk.
 * @param root - The absolute project root, for relative paths.
 * @param skip - Directory names to skip.
 * @param found - The accumulator that gathers the repo-relative paths.
 */
function visitDirectory(
  dir: string,
  root: string,
  skip: ReadonlySet<string>,
  found: string[],
): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory() && !skip.has(entry.name)) {
      visitDirectory(absolute, root, skip, found);
    } else if (entry.isFile()) {
      found.push(relative(root, absolute).replaceAll("\\", "/"));
    }
  }
}

/**
 * The files a run discovers: the git files when available, else a walk, with
 * the excluded directories removed.
 *
 * @param root - The absolute project root.
 * @returns Repo-relative paths.
 */
export function discoverFiles(root: string): string[] {
  const skip = excludedDirectories();
  const files = (gitFiles(root) ?? walkFiles(root, skip)).filter(
    (rel) => !rel.split("/").some((segment) => skip.has(segment)),
  );
  const scope = scopedFiles();
  return scope ? files.filter((rel) => scope.has(rel)) : files;
}
