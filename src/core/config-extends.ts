/**
 * Resolving and merging the `extends` chain of a config file.
 *
 * @remarks Kept apart from {@link ../core/config.ts} so that module stays
 * inside its line budget, and because the two answer different questions: this
 * one produces a single raw config from several files, that one validates the
 * result and applies it over rule defaults.
 *
 * The merge follows Biome, which is the config most users of this stack will
 * already have: a child's fields win individually, unset fields inherit, and
 * arrays replace rather than concatenate. Replacement is what makes a
 * consumer able to drop an entry a preset allowed; concatenation would make
 * every inherited list permanent.
 *
 * @packageDocumentation
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";

/** One rule settings block, before validation. */
interface RawRuleBlock {
  /** Severity as written. */
  severity?: string;
  /** Globs selecting files. */
  include?: string[];
  /** Globs removed from that selection. */
  exclude?: string[];
  /** Rule options, shape known only to the rule. */
  options?: unknown;
  /** Guideline path replacing the rule's own. */
  docs?: string;
}

/** A rule entry: a bare severity, a block, or several blocks. */
type RawRuleSetting = string | RawRuleBlock | RawRuleBlock[];

/** A config file as parsed, before validation and before defaults. */
export interface RawConfig {
  /** Editor schema reference, ignored when inherited. */
  $schema?: string;
  /** Project root override, ignored when inherited. */
  root?: string;
  /** Configs this one builds on, nearest last. */
  extends?: string | string[];
  /** Modules contributing rules. */
  plugins?: string[];
  /** Settings keyed by rule id. */
  rules?: Record<string, RawRuleSetting>;
  /** Project documents mapped onto rules. */
  guidelines?: Record<string, string[]>;
}

/**
 * Whether a specifier names a file rather than a package.
 *
 * @remarks Only a leading `.` or an absolute path counts. Anything else is a
 * package specifier, so a scoped name such as `@acme/preset/vibator.json`
 * resolves through the package's `exports` instead of being mistaken for a
 * directory below the project root.
 * @param specifier - The specifier as written.
 * @returns `true` when it should resolve as a path.
 */
function isPathSpecifier(specifier: string): boolean {
  return specifier.startsWith(".") || isAbsolute(specifier);
}

/**
 * Resolves one `extends` entry to a file on disk.
 *
 * @param specifier - The entry as written.
 * @param fromFile - Absolute path of the config that declared it.
 * @returns The absolute path of the config to load.
 * @throws When the specifier names nothing that exists.
 */
function resolveExtendsTarget(specifier: string, fromFile: string): string {
  if (isPathSpecifier(specifier)) {
    const target = resolve(dirname(fromFile), specifier);
    if (existsSync(target)) return target;
    throw new Error(
      `Config extends "${specifier}", which does not exist\n  at ${fromFile}`,
    );
  }
  try {
    return createRequire(fromFile).resolve(specifier);
  } catch {
    throw new Error(
      `Config extends "${specifier}", which no installed package provides\n  at ${fromFile}`,
    );
  }
}

/**
 * Reads and parses one config file.
 *
 * @param file - Absolute path to the file.
 * @returns Its parsed contents.
 * @throws When the file is not valid JSON.
 */
function readRawConfig(file: string): RawConfig {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as RawConfig;
  } catch (cause) {
    throw new Error(`Invalid JSON in ${file}: ${(cause as Error).message}`);
  }
}

/**
 * Rewrites every path an inherited config states so it keeps its meaning.
 *
 * @remarks A preset's `docs` and `guidelines` name documents that ship beside
 * the preset, not files in the consumer's repository. Resolving them here, to
 * absolute paths, means every consumer downstream keeps working unchanged:
 * `resolve(root, absolute)` returns the absolute path untouched.
 * @param config - The inherited config.
 * @param file - Absolute path of the file it came from.
 * @returns The same config with its paths made absolute.
 */
function rebaseConfig(config: RawConfig, file: string): RawConfig {
  const base = dirname(file);
  const rules = Object.fromEntries(
    Object.entries(config.rules ?? {}).map(([id, setting]) => [
      id,
      rebaseSetting(setting, base),
    ]),
  );
  const guidelines = Object.fromEntries(
    Object.entries(config.guidelines ?? {}).map(([document, ruleIds]) => [
      resolve(base, document),
      ruleIds,
    ]),
  );
  const plugins = (config.plugins ?? []).map((plugin) =>
    isPathSpecifier(plugin) ? resolve(base, plugin) : plugin,
  );
  return { ...config, plugins, rules, guidelines };
}

/**
 * Rebases the `docs` path of every block in one rule entry.
 *
 * @param setting - The entry as written.
 * @param base - Directory of the config that declared it.
 * @returns The entry with absolute `docs` paths.
 */
function rebaseSetting(setting: RawRuleSetting, base: string): RawRuleSetting {
  if (typeof setting === "string") return setting;
  const rebaseBlock = (block: RawRuleBlock): RawRuleBlock =>
    block.docs === undefined
      ? block
      : { ...block, docs: resolve(base, block.docs) };
  return Array.isArray(setting)
    ? setting.map(rebaseBlock)
    : rebaseBlock(setting);
}

/**
 * Whether a value is a plain object, and so mergeable field by field.
 *
 * @param value - The value to test.
 * @returns `true` for plain objects, `false` for arrays and primitives.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merges two option objects, the child winning.
 *
 * @remarks Nested objects merge; arrays replace. This is Biome's behaviour,
 * verified against 2.5.5, and it matches the rule `include` and `exclude`
 * already follow.
 * @param parent - Options from the inherited config.
 * @param child - Options from the config doing the extending.
 * @returns The merged options.
 */
function mergeOptions(parent: unknown, child: unknown): unknown {
  if (child === undefined) return parent;
  if (!isPlainObject(parent) || !isPlainObject(child)) return child;
  return {
    ...parent,
    ...Object.fromEntries(
      Object.entries(child).map(([key, value]) => [
        key,
        mergeOptions(parent[key], value),
      ]),
    ),
  };
}

/**
 * Normalises a rule entry to a block, when it is a single one.
 *
 * @param setting - The entry as written.
 * @returns The equivalent block, or `undefined` for the multi-block form.
 */
function asBlock(setting: RawRuleSetting): RawRuleBlock | undefined {
  if (Array.isArray(setting)) return undefined;
  return typeof setting === "string" ? { severity: setting } : setting;
}

/**
 * Merges one rule entry over the inherited one.
 *
 * @remarks The multi-block array form replaces wholesale on either side:
 * there is no meaningful way to pair up two lists of blocks, and silently
 * matching them by position would be worse than replacing.
 * @param parent - The inherited entry, if any.
 * @param child - The entry from the extending config.
 * @returns The merged entry.
 */
function mergeSetting(
  parent: RawRuleSetting | undefined,
  child: RawRuleSetting,
): RawRuleSetting {
  if (parent === undefined) return child;
  const parentBlock = asBlock(parent);
  const childBlock = asBlock(child);
  if (!parentBlock || !childBlock) return child;
  return {
    ...parentBlock,
    ...childBlock,
    options: mergeOptions(parentBlock.options, childBlock.options),
  };
}

/**
 * Merges guideline maps, taking the union of rule ids per document.
 *
 * @param parent - Guidelines from the inherited config.
 * @param child - Guidelines from the config doing the extending.
 * @returns The merged map.
 */
function mergeGuidelines(
  parent: Record<string, string[]>,
  child: Record<string, string[]>,
): Record<string, string[]> {
  return {
    ...parent,
    ...Object.fromEntries(
      Object.entries(child).map(([document, ruleIds]) => [
        document,
        [...new Set([...(parent[document] ?? []), ...ruleIds])],
      ]),
    ),
  };
}

/**
 * Merges one config over another.
 *
 * @remarks `root` and `$schema` are deliberately not inherited: both describe
 * the file they appear in, and a preset's idea of the project root is not the
 * consumer's.
 * @param parent - The inherited config.
 * @param child - The config doing the extending.
 * @returns The merged config.
 */
function mergeConfig(parent: RawConfig, child: RawConfig): RawConfig {
  const rules = {
    ...parent.rules,
    ...Object.fromEntries(
      Object.entries(child.rules ?? {}).map(([id, setting]) => [
        id,
        mergeSetting(parent.rules?.[id], setting),
      ]),
    ),
  };
  return {
    $schema: child.$schema,
    root: child.root,
    plugins: [
      ...new Set([...(parent.plugins ?? []), ...(child.plugins ?? [])]),
    ],
    rules,
    guidelines: mergeGuidelines(
      parent.guidelines ?? {},
      child.guidelines ?? {},
    ),
  };
}

/**
 * Loads a config and everything it extends, merged into one.
 *
 * @remarks Depth first and in declaration order, so a later entry in
 * `extends` wins over an earlier one and the file itself wins over all of
 * them. Every inherited file is rebased before merging, so its paths keep
 * pointing where its author meant.
 * @param file - Absolute path of the config to load.
 * @param seen - Files already on this chain, for cycle detection.
 * @returns The merged config.
 * @throws On a cycle, a missing target, or invalid JSON.
 */
export function resolveConfigChain(
  file: string,
  seen: string[] = [],
): RawConfig {
  if (seen.includes(file)) {
    throw new Error(
      `Config extends itself:\n  ${[...seen, file].join("\n  ")}`,
    );
  }
  const own = readRawConfig(file);
  const parents = own.extends === undefined ? [] : [own.extends].flat();
  const inherited = parents.reduce<RawConfig>((accumulated, specifier) => {
    const target = resolveExtendsTarget(specifier, file);
    const parent = resolveConfigChain(target, [...seen, file]);
    return mergeConfig(accumulated, rebaseConfig(parent, target));
  }, {});
  return mergeConfig(inherited, own);
}
