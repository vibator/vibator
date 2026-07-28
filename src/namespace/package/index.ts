/**
 * The `package` namespace: parse and manage `package.json` files.
 *
 * @packageDocumentation
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { File } from "../project/index.ts";
import { requireRoot } from "../runtime.ts";

/**
 * A parsed `package.json`.
 */
export interface PackageManifest {
  /** The package name. */
  readonly name: string;
  /** The package version. */
  readonly version: string;
  /** The scripts, keyed by name. */
  readonly scripts: Record<string, string>;
  /** The runtime dependencies, keyed by name. */
  readonly dependencies: Record<string, string>;
  /** The development dependencies, keyed by name. */
  readonly devDependencies: Record<string, string>;
  /** The peer dependencies, keyed by name. */
  readonly peerDependencies: Record<string, string>;
}

/**
 * Coerces a value to a string map, defaulting to an empty one.
 *
 * @param value - The value to coerce.
 * @returns The value as a string map, or an empty map.
 */
function stringMap(value: unknown): Record<string, string> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, string>)
    : {};
}

/**
 * Builds a manifest from `package.json` content.
 *
 * @param content - The `package.json` content.
 * @returns The parsed manifest.
 */
function toManifest(content: string): PackageManifest {
  const raw = JSON.parse(content) as Record<string, unknown>;
  return {
    name: typeof raw.name === "string" ? raw.name : "",
    version: typeof raw.version === "string" ? raw.version : "",
    scripts: stringMap(raw.scripts),
    dependencies: stringMap(raw.dependencies),
    devDependencies: stringMap(raw.devDependencies),
    peerDependencies: stringMap(raw.peerDependencies),
  };
}

/**
 * Parse and manage `package.json` files.
 *
 * @remarks Exported as `pkg` because `package` is a reserved word; it is exposed
 * on the framework namespace as `vibator.package`.
 */
export const pkg = {
  /** The parsed root `package.json`. */
  get root(): PackageManifest {
    return toManifest(
      readFileSync(join(requireRoot(), "package.json"), "utf8"),
    );
  },

  /**
   * Parses a `package.json` file into a manifest.
   *
   * @param file - The `package.json` file to parse.
   * @returns The parsed manifest.
   */
  parse(file: File): PackageManifest {
    return toManifest(file.content);
  },
};
