/**
 * The `module` namespace: resolve references to files.
 *
 * @packageDocumentation
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { requireRoot } from "../runtime.ts";

/** Matches a `package:path` reference, capturing the package and the path. */
const PACKAGED = /^(@[^:/\\]+\/[^:/\\]+|[^:/\\]+):(.+)$/;

/**
 * The directory of an installed package, found through Node's module search
 * paths. The package's `exports` map plays no part, so any installed package
 * is found.
 *
 * @param name - The package name, scoped or unscoped.
 * @param from - The file the search starts from.
 * @returns The absolute package directory.
 * @throws When the package is not installed.
 */
function packageDirectory(name: string, from: string): string {
  const require = createRequire(pathToFileURL(from).href);
  for (const candidate of require.resolve.paths(name) ?? []) {
    const directory = join(candidate, name);
    if (existsSync(join(directory, "package.json"))) return directory;
  }
  throw new Error(`Cannot find a package named "${name}" from ${from}`);
}

/**
 * Resolves a `package:path` reference to the file inside the package.
 *
 * @param specifier - The specifier to match.
 * @param from - The file the package resolves from.
 * @returns The absolute file path, or undefined when the specifier carries
 * no package prefix.
 * @throws When the named package is not installed.
 */
function packagedFile(specifier: string, from: string): string | undefined {
  const match = specifier.match(PACKAGED);
  if (!match?.[1] || !match[2]) return undefined;
  return join(packageDirectory(match[1], from), match[2]);
}

/**
 * The error for a specifier that resolves as no package. A file-looking
 * specifier carries the `./` hint.
 *
 * @param specifier - The specifier that failed.
 * @param error - The resolution error.
 * @returns The error to throw.
 */
function packageError(specifier: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const hint = /[./]/.test(specifier)
    ? ` A project file starts with "./".`
    : "";
  return new Error(
    `Cannot find a package for "${specifier}".${hint}\n${message}`,
  );
}

/**
 * Resolve references to files.
 */
export const module = {
  /**
   * Resolves a reference to an absolute file path in this order:
   *
   * 1. An absolute path: returned as it is.
   * 2. A `package:path` reference: the file inside the installed package,
   *    ignoring its `exports` map.
   * 3. A path starting with `.`: joined onto the directory of `from`.
   * 4. Anything else: a package specifier resolved by Node, honoring the
   *    `exports` map.
   *
   * Local paths are not checked for existence.
   *
   * @param specifier - The reference to resolve.
   * @param from - The file the resolution starts from, defaulting to the
   * root `package.json`.
   * @returns The absolute file path.
   * @throws Error When a package is not installed.
   */
  resolve(
    specifier: string,
    from: string = join(requireRoot(), "package.json"),
  ): string {
    if (isAbsolute(specifier) || specifier.startsWith(".")) {
      return resolve(dirname(from), specifier);
    }
    const packaged = packagedFile(specifier, from);
    if (packaged !== undefined) return packaged;
    try {
      return createRequire(pathToFileURL(from).href).resolve(specifier);
    } catch (error) {
      throw packageError(specifier, error);
    }
  },
};
