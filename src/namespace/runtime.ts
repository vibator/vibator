/**
 * Shared runtime state for the namespace.
 *
 * @packageDocumentation
 */

/** The absolute project root of the current run. */
let root: string | undefined;

/**
 * Sets the absolute project root for the current run.
 *
 * @param absolute - The absolute path of the project root.
 */
export function setRoot(absolute: string): void {
  root = absolute;
}

/**
 * Returns the absolute project root of the current run.
 *
 * @returns The absolute project root.
 * @throws When no root has been set.
 */
export function requireRoot(): string {
  if (root === undefined) {
    throw new Error("no project root set for this run");
  }
  return root;
}

/** The directories file discovery skips unless configuration overrides them. */
const DEFAULT_EXCLUDED_DIRECTORIES: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
]);

/** The excluded directories for the current run, when configuration sets them. */
let excluded: ReadonlySet<string> | undefined;

/**
 * Sets the directories file discovery skips for the current run.
 *
 * @param names - The directory names to skip.
 */
export function setExcludedDirectories(names: string[]): void {
  excluded = new Set(names);
}

/**
 * Returns the directories file discovery skips.
 *
 * @returns The excluded directory names, defaulting to the built-in list.
 */
export function excludedDirectories(): ReadonlySet<string> {
  return excluded ?? DEFAULT_EXCLUDED_DIRECTORIES;
}

/** The files in scope for the current run, when a scope is set. */
let scope: ReadonlySet<string> | undefined;

/**
 * Sets the files in scope for the current run, from `--staged`, `--changed`, or
 * `--since`.
 *
 * @param paths - The repo-relative paths in scope, or undefined for every file.
 */
export function setScope(paths: string[] | undefined): void {
  scope = paths ? new Set(paths) : undefined;
}

/**
 * Returns the files in scope for the current run.
 *
 * @returns The repo-relative paths in scope, or undefined when every file is.
 */
export function scopedFiles(): ReadonlySet<string> | undefined {
  return scope;
}
