/**
 * Configuration loading and per-rule resolution.
 *
 * @packageDocumentation
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { resolveConfigChain } from "./config-extends.ts";
import type { Severity } from "./diagnostic.ts";
import type { AnyRule } from "./rule.ts";

/** Filenames looked for, in order, when none is passed explicitly. */
const CONFIG_FILENAMES = ["vibator.json", ".vibator.json"];

/** Severity as written in config. */
const severitySchema = z.enum(["error", "warn", "off"]);

/** One settings block for a rule. */
const ruleBlockSchema = z.object({
  severity: severitySchema.optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  options: z.unknown().optional(),
  docs: z.string().optional(),
});

/**
 * A rule entry: a bare severity, a block, or several blocks.
 *
 * @remarks The array form runs the rule once per block, so one codebase can
 * hold different areas to different standards, such as a 400-line budget in `src/`
 * and an 800-line one in tests, without writing the rule twice.
 */
const ruleSettingSchema = z.union([
  severitySchema,
  ruleBlockSchema,
  z.array(ruleBlockSchema).min(1),
]);

/**
 * Configs this one builds on.
 *
 * @remarks A repo-relative path or a package specifier, resolved against the
 * file that declares it. Later entries win over earlier ones, and the file's
 * own settings win over all of them. A child's fields win one by one, unset
 * fields inherit, and arrays replace rather than concatenate, which is how
 * Biome behaves and so what a reader of this stack already expects.
 */
const extendsSchema = z.union([z.string(), z.array(z.string())]);

/** The whole config file. */
const configSchema = z.object({
  $schema: z.string().optional(),
  root: z.string().optional(),
  extends: extendsSchema.optional(),
  recommended: z.boolean().default(true),
  plugins: z.array(z.string()).default([]),
  rules: z.record(z.string(), ruleSettingSchema).default({}),
  guidelines: z.record(z.string(), z.array(z.string())).default({}),
});

/** A validated config file. */
export type Config = z.infer<typeof configSchema>;

/** One rule's settings, with every default already applied. */
export interface ResolvedRule {
  /** The rule itself. */
  rule: AnyRule;
  /** Severity to report its findings at. */
  severity: Exclude<Severity, "off">;
  /** Globs selecting files to judge. */
  include: string[];
  /** Globs removed from that selection. */
  exclude: string[];
  /** Options, validated against the rule's schema. */
  options: unknown;
  /**
   * The guideline this rule points at: the project's override when one is
   * configured, otherwise the one shipped with the rule.
   */
  docs: string;
  /** Whether {@link ResolvedRule.docs} is a project file rather than a built-in. */
  docsOverridden: boolean;
  /** Project guideline documents mapped onto this rule, if any. */
  guidelines: string[];
}

/**
 * Finds and parses the config file.
 *
 * @param root - Absolute project root.
 * @param explicitPath - A `--config` path, when one was given.
 * @returns The validated config, or defaults when no file exists.
 */
export function loadConfig(root: string, explicitPath?: string): Config {
  const candidates = explicitPath
    ? [resolve(root, explicitPath)]
    : CONFIG_FILENAMES.map((name) => resolve(root, name));
  const found = candidates.find((candidate) => existsSync(candidate));

  if (!found) {
    if (explicitPath) throw new Error(`Config not found: ${explicitPath}`);
    return configSchema.parse({});
  }

  const parsed = configSchema.safeParse(resolveConfigChain(found));
  if (!parsed.success) {
    throw new Error(
      `Invalid config in ${found}:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

/**
 * Normalises a rule entry to its list of settings blocks.
 *
 * @param setting - The raw entry from config.
 * @returns One block per configured instance; a single default block when the
 * rule is absent from config.
 */
function blocksOf(
  setting: z.infer<typeof ruleSettingSchema> | undefined,
): z.infer<typeof ruleBlockSchema>[] {
  if (setting === undefined) return [{}];
  if (typeof setting === "string") return [{ severity: setting }];
  return Array.isArray(setting) ? setting : [setting];
}

/**
 * Which project guideline documents mention a rule.
 *
 * @param config - The loaded config.
 * @param ruleId - The rule to look up.
 * @returns Document paths naming that rule, in config order.
 */
function guidelinesFor(config: Config, ruleId: string): string[] {
  return Object.entries(config.guidelines)
    .filter(([, ruleIds]) => ruleIds.includes(ruleId))
    .map(([document]) => document);
}

/**
 * Applies config over rule defaults.
 *
 * @remarks Rules absent from config still run, at their own default severity.
 * A quality gate that silently checks nothing until configured is worse than
 * one that is occasionally too noisy, and `"off"` is always one line away.
 * Setting `recommended` to `false` inverts that: only rules the config names
 * run, the shape a curated preset or a deliberately narrow gate wants.
 * @param config - The loaded config.
 * @param rules - The rules to resolve.
 * @param known - Every registered rule, when `rules` is a subset. Config keys
 * are validated against this, so narrowing the selection does not make the
 * remaining rules look unknown.
 * @returns The enabled rules, in registry order.
 * @throws When a config key names no known rule, or options fail validation.
 */
export function resolveRules(
  config: Config,
  rules: AnyRule[],
  known?: AnyRule[],
): ResolvedRule[] {
  const registered = new Set((known ?? rules).map((rule) => rule.id));
  const unknown = Object.keys(config.rules).filter((id) => !registered.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown rule(s) in config: ${unknown.join(", ")}\n` +
        `Known rules: ${[...registered].sort().join(", ")}`,
    );
  }

  return rules.flatMap((rule) => resolveOne(config, rule));
}

/**
 * Validates one block's options against the rule's own schema.
 *
 * @param rule - The rule whose schema judges the options.
 * @param raw - The options as written in config.
 * @returns The parsed options, defaults applied.
 * @throws When the options fail the schema.
 */
function optionsOf(rule: AnyRule, raw: unknown): unknown {
  const options = rule.optionsSchema.safeParse(raw ?? {});
  if (!options.success) {
    throw new Error(
      `Invalid options for rule "${rule.id}":\n${z.prettifyError(options.error)}`,
    );
  }
  return options.data;
}

/**
 * Resolves one settings block for a rule.
 *
 * @param config - The loaded config.
 * @param rule - The rule being resolved.
 * @param block - The settings block to apply over the rule's defaults.
 * @returns A single-entry array, or an empty one when the block is off.
 */
function resolveBlock(
  config: Config,
  rule: AnyRule,
  block: z.infer<typeof ruleBlockSchema>,
): ResolvedRule[] {
  const severity = block.severity ?? rule.defaultSeverity;
  if (severity === "off") return [];

  return [
    {
      rule,
      severity,
      include: block.include ?? rule.defaultInclude,
      exclude: block.exclude ?? rule.defaultExclude ?? [],
      options: optionsOf(rule, block.options),
      docs: block.docs ?? rule.docs,
      docsOverridden: block.docs !== undefined,
      guidelines: guidelinesFor(config, rule.id),
    },
  ];
}

/**
 * Resolves one rule against config.
 *
 * @remarks A rule the config never mentions runs only while `recommended`
 * holds; once it is `false`, naming a rule is what enables it. Only an
 * explicit `false` drops the baseline: {@link Config} is public API, and a
 * caller building one by hand rather than through {@link loadConfig} must
 * not lose every rule to an absent field.
 * @param config - The loaded config.
 * @param rule - The rule to resolve.
 * @returns One entry per enabled settings block; none when the rule is off.
 * @throws When any block's options fail the rule's own schema.
 */
function resolveOne(config: Config, rule: AnyRule): ResolvedRule[] {
  const setting = config.rules[rule.id];
  if (setting === undefined && config.recommended === false) return [];
  return blocksOf(setting).flatMap((block) =>
    resolveBlock(config, rule, block),
  );
}
