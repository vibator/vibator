/**
 * The `.vibator.json` configuration file and its loader.
 *
 * @packageDocumentation
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { module } from "../namespace/module/index.ts";
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
}

/**
 * The `.vibator.json` configuration file. It is optional and overrides the
 * default configuration.
 */
export interface Config {
  /** The path or URL of the schema that validates this file. */
  $schema?: string;
  /** Paths or package names of base configs to inherit, applied in order. */
  extends?: string[];
  /**
   * Paths or package names of plugin modules: modules outside `.vibator/` that
   * add namespaces to `vibator`, register rules, or both.
   */
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
 * Turns a rule entry into its object form.
 *
 * @param entry - A severity shorthand or a rule config.
 * @returns The rule config.
 */
function ruleConfig(entry: Severity | RuleConfig): RuleConfig {
  return typeof entry === "string" ? { severity: entry } : entry;
}

/**
 * Merges two entries for one rule: the severity of the later one wins, and
 * options merge by key.
 *
 * @param base - The inherited entry.
 * @param own - The entry that overrides it.
 * @returns The merged entry.
 */
function mergeRule(
  base: Severity | RuleConfig,
  own: Severity | RuleConfig,
): RuleConfig {
  const from = ruleConfig(base);
  const to = ruleConfig(own);
  const merged: RuleConfig = { ...from, ...to };
  if (from.options !== undefined && to.options !== undefined) {
    merged.options = { ...from.options, ...to.options };
  }
  return merged;
}

/**
 * Merges two plugin lists: the inherited plugins first, then the own, each once.
 *
 * @param base - The inherited plugins.
 * @param own - The config's own plugins.
 * @returns The merged list, or `undefined` when neither config sets plugins.
 */
function mergePlugins(base?: string[], own?: string[]): string[] | undefined {
  if (base === undefined && own === undefined) return undefined;
  return [...new Set([...(base ?? []), ...(own ?? [])])];
}

/**
 * Merges two rule maps by id, merging the entries of a rule both set.
 *
 * @param base - The inherited rules.
 * @param own - The config's own rules.
 * @returns The merged rules, or `undefined` when neither config sets rules.
 */
function mergeRules(
  base?: Config["rules"],
  own?: Config["rules"],
): Config["rules"] {
  if (base === undefined) return own;
  const rules = { ...base };
  for (const [id, entry] of Object.entries(own ?? {})) {
    const inherited = rules[id];
    rules[id] = inherited === undefined ? entry : mergeRule(inherited, entry);
  }
  return rules;
}

/**
 * Merges a config onto an inherited one. Plugins add up, once each; `exclude`
 * is replaced; rules merge by id. The `$schema` field is never inherited.
 *
 * @param base - The inherited config.
 * @param own - The config that overrides it.
 * @returns The merged config, without `extends`.
 */
function mergeConfig(base: Config, own: Config): Config {
  const merged: Config = {
    $schema: own.$schema,
    plugins: mergePlugins(base.plugins, own.plugins),
    exclude: own.exclude ?? base.exclude,
    rules: mergeRules(base.rules, own.rules),
  };
  for (const key of Object.keys(merged) as (keyof Config)[]) {
    if (merged[key] === undefined) delete merged[key];
  }
  return merged;
}

/**
 * Reads a config file and resolves its `extends` chain into one config. The
 * plugins of a base resolve from the base file, so they come out absolute.
 *
 * @param file - The absolute path of the config file.
 * @param chain - The config files being read above this one.
 * @returns The resolved config.
 * @throws When a config extends itself through the chain.
 */
function resolveConfig(file: string, chain: string[]): Config {
  if (chain.includes(file)) {
    throw new Error(`Circular extends: ${[...chain, file].join(" -> ")}`);
  }
  const { extends: bases, ...own } = configSchema.parse(
    JSON.parse(readFileSync(file, "utf8")),
  );
  let inherited: Config = {};
  for (const specifier of bases ?? []) {
    const baseFile = module.resolve(specifier, file);
    const base = resolveConfig(baseFile, [...chain, file]);
    if (base.plugins !== undefined) {
      base.plugins = base.plugins.map((plugin) =>
        module.resolve(plugin, baseFile),
      );
    }
    inherited = mergeConfig(inherited, base);
  }
  return bases === undefined ? own : mergeConfig(inherited, own);
}

/**
 * Loads the configuration, validates it against the schema, and resolves its
 * `extends` chain.
 *
 * @remarks Reads `.vibator.json` from the project root when no path is given.
 * @param path - The path to load, when the file lives elsewhere.
 * @returns The parsed configuration, or an empty config when the file is absent.
 */
export function load(path?: string): Config {
  const target = path ?? join(requireRoot(), ".vibator.json");
  if (!existsSync(target)) return {};
  return resolveConfig(resolve(target), []);
}
