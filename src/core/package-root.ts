/**
 * Where this package is installed, wherever that happens to be.
 *
 * @remarks Resolved from this module's own URL rather than from `node_modules`,
 * so it holds under every package manager layout — npm, pnpm's store, Yarn PnP
 * unplugged directories, or a checkout of this repository itself.
 *
 * @packageDocumentation
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute path of this package's own directory.
 *
 * @remarks This module lives one directory below the package root — `src/core`
 * in a checkout, `dist/core` when built — so the root is two levels up.
 */
export const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/**
 * The version this package was published as.
 *
 * @returns The `version` field of the package manifest.
 */
export function packageVersion(): string {
  const manifest = JSON.parse(
    readFileSync(join(packageRoot, "package.json"), "utf8"),
  ) as { version: string };
  return manifest.version;
}
