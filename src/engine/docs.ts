/**
 * Resolves a rule's guideline path.
 *
 * @packageDocumentation
 */
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

/**
 * Resolves a rule's docs value to an absolute path, from the project root or a
 * package when prefixed with `name:`.
 *
 * @param docs - The docs value from the rule or its config override.
 * @param root - The absolute project root.
 * @returns The absolute path of the guideline.
 */
export function resolveDocs(docs: string, root: string): string {
  const packaged = docs.match(/^([^:/\\]+):(.+)$/);
  if (packaged) {
    const packagePath = createRequire(import.meta.url).resolve(
      `${packaged[1]}/package.json`,
    );
    return join(dirname(packagePath), packaged[2] ?? "");
  }
  return resolve(root, docs);
}
