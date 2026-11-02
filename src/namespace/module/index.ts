/**
 * The `module` namespace: resolve references to files.
 *
 * @packageDocumentation
 */
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { requireRoot } from "../runtime.ts";

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
   * 2. A path starting with `.`: joined onto the directory of `from`.
   * 3. Anything else: a package specifier resolved by Node, honoring the
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
    try {
      return createRequire(pathToFileURL(from).href).resolve(specifier);
    } catch (error) {
      throw packageError(specifier, error);
    }
  },
};
