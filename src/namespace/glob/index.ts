/**
 * The `glob` namespace: match paths against globs.
 *
 * @packageDocumentation
 */
import { matchesGlob } from "node:path";

/**
 * Match paths against globs, with `!` prefixes read as exclusions.
 */
export const glob = {
  /**
   * Whether a path matches the globs and none of the exclusions.
   *
   * @param path - The path to test.
   * @param globs - One glob, or several; a `!` prefix marks an exclusion.
   * @returns Whether the path is included and not excluded.
   */
  matches(path: string, globs: string | string[]): boolean {
    const list = Array.isArray(globs) ? globs : [globs];
    const includes = list.filter((glob) => !glob.startsWith("!"));
    const excludes = list
      .filter((glob) => glob.startsWith("!"))
      .map((glob) => glob.slice(1));
    const included =
      includes.length === 0 || includes.some((glob) => matchesGlob(path, glob));
    const excluded = excludes.some((glob) => matchesGlob(path, glob));
    return included && !excluded;
  },
};
