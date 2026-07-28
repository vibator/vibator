/**
 * The `module` namespace: resolve module specifiers to files.
 *
 * @packageDocumentation
 */
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { requireRoot } from "../runtime.ts";

/**
 * Whether a specifier is a path rather than a package name.
 *
 * @param specifier - The specifier to classify.
 * @returns Whether the specifier is a path.
 */
function isPath(specifier: string): boolean {
  return (
    specifier.startsWith(".") ||
    isAbsolute(specifier) ||
    (specifier.includes("/") && !specifier.startsWith("@"))
  );
}

/**
 * Resolve module specifiers to files.
 */
export const module = {
  /**
   * Resolves a path or package name to an absolute file path.
   *
   * @param specifier - A path relative to `from`, or a package name.
   * @param from - The file the resolution is relative to, defaulting to the
   * root `package.json`.
   * @returns The absolute file path.
   */
  resolve(
    specifier: string,
    from: string = join(requireRoot(), "package.json"),
  ): string {
    if (isPath(specifier)) {
      return resolve(dirname(from), specifier);
    }
    return createRequire(pathToFileURL(from).href).resolve(specifier);
  },
};
