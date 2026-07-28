/**
 * The `.vibator.json` configuration file and its loader.
 *
 * @packageDocumentation
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { module } from "../namespace/module/index.ts";
import { object } from "../namespace/object/index.ts";
import { requireRoot } from "../namespace/runtime.ts";
import type { Severity } from "../rules/index.ts";

/**
 * The override one rule accepts.
 */
export interface RuleConfig {
  /** The severity applied to this rule. */
  severity?: Severity;
  /** The rule's options, validated by the rule's own schema. */
  options?: object;
  /**
   * The path to the guideline shown for this rule. It resolves from the project
   * root, such as `.vibator/docs/my-rule.md`, or from a package when prefixed
   * with the package name, such as `vibator:docs/rules/no-deprecated-apis.md`.
   */
  docs?: string;
}

/**
 * The `.vibator.json` configuration file. It is optional and overrides the
 * default configuration.
 */
export interface Config {
  /** The path or URL of the schema that validates this file. */
  $schema?: string;
  /** Paths or package names of base configs to inherit. */
  extends?: string[];
  /** Paths or package names of rule modules that live outside `.vibator/`. */
  plugins?: string[];
  /** Directory names to skip during file discovery, replacing the built-in defaults. */
  exclude?: string[];
  /**
   * Per-rule overrides, keyed by rule id. An entry is a {@link Severity} for the
   * severity shorthand, or a {@link RuleConfig}.
   */
  rules?: Record<string, Severity | RuleConfig>;
}

const severitySchema = z.enum(["error", "warn", "off"]);

const ruleConfigSchema = z.strictObject({
  severity: severitySchema.optional(),
  options: z.record(z.string(), z.unknown()).optional(),
  docs: z.string().optional(),
});

/** The schema that validates a `.vibator.json`, emitted to `schema.json`. */
export const configSchema = z.strictObject({
  $schema: z.string().optional(),
  extends: z.array(z.string()).optional(),
  plugins: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  rules: z
    .record(z.string(), z.union([severitySchema, ruleConfigSchema]))
    .optional(),
});

/**
 * Reads a config file and resolves its extends chain into one config.
 *
 * @param file - The absolute config file path.
 * @param seen - The config files already read in this resolution.
 * @returns The resolved configuration.
 * @throws When a config is reached twice in the chain.
 */
function resolveConfig(file: string, seen: Set<string>): Config {
  if (seen.has(file)) {
    throw new Error(`Circular extends: ${file}`);
  }
  seen.add(file);

  const { extends: bases, ...own } = configSchema.parse(
    JSON.parse(readFileSync(file, "utf8")),
  );

  let merged: Config = {};
  for (const base of bases ?? []) {
    merged = object.merge(
      merged,
      resolveConfig(module.resolve(base, file), seen),
    );
  }
  return object.merge(merged, own as Config);
}

/**
 * Loads the configuration, validating it against the schema and resolving its
 * extends chain.
 *
 * @remarks Reads `.vibator.json` from the project root when no path is given.
 * @param path - The path to load, when the file lives elsewhere.
 * @returns The parsed configuration, or an empty config when the file is absent.
 */
export function load(path?: string): Config {
  const target = path ?? join(requireRoot(), ".vibator.json");
  if (!existsSync(target)) return {};
  return resolveConfig(resolve(target), new Set());
}
