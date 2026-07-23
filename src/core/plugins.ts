/**
 * Loading rules that ship outside this package.
 *
 * @remarks The built-in rules are the opinionated starting set, not the whole
 * story: every project has standards only it can state. A plugin is any module
 * whose default export is a rule, or an array of them, and it is registered and
 * configured exactly like a built-in one.
 *
 * @packageDocumentation
 */

import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { AnyRule } from "./rule.ts";

/** The shape a plugin module must export by default. */
type PluginExport = AnyRule | AnyRule[];

/**
 * Whether a value looks like a usable rule.
 *
 * @remarks Checked structurally rather than by instance, because a plugin may
 * be built against a different copy of this package. A bad plugin should fail
 * with a message naming the missing field, not with a property access on
 * `undefined` three layers into the engine.
 * @param value - The exported value to inspect.
 * @returns `true` when the value satisfies the rule contract.
 */
function isRule(value: unknown): value is AnyRule {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AnyRule>;

  const named =
    typeof candidate.id === "string" && typeof candidate.title === "string";
  const documented = typeof candidate.docs === "string";
  const configurable =
    Array.isArray(candidate.defaultInclude) &&
    typeof candidate.optionsSchema === "object";
  const runnable =
    (candidate.scope === "file" &&
      typeof (candidate as { checkFile?: unknown }).checkFile === "function") ||
    (candidate.scope === "project" &&
      typeof (candidate as { check?: unknown }).check === "function");

  return named && documented && configurable && runnable;
}

/**
 * Describes what a plugin export is missing.
 *
 * @param specifier - The plugin as written in config.
 * @returns An error naming the contract the export failed.
 */
function invalidPlugin(specifier: string): Error {
  return new Error(
    `Plugin "${specifier}" must default-export a rule, or an array of rules.\n` +
      "A rule needs: id, title, docs, defaultSeverity, defaultInclude,\n" +
      'optionsSchema, and either checkFile (scope "file") or check (scope "project").',
  );
}

/**
 * Resolves a plugin specifier to something `import()` accepts.
 *
 * @remarks A relative or absolute path is resolved against the project root and
 * converted to a file URL, so plugins living in the repository work without
 * being installed. Anything else is left alone and resolved as a package name.
 * A scoped name is a package despite containing a slash, so a preset can ship
 * its rules as `@acme/vibator-rules` and be extended by name.
 * @param root - Absolute project root.
 * @param specifier - The plugin as written in config.
 * @returns The specifier to import.
 */
function resolveSpecifier(root: string, specifier: string): string {
  const isPath =
    specifier.startsWith(".") ||
    isAbsolute(specifier) ||
    (specifier.includes("/") && !specifier.startsWith("@"));
  if (!isPath) return specifier;
  return pathToFileURL(resolve(root, specifier)).href;
}

/**
 * Loads every configured plugin and returns the rules they contribute.
 *
 * @param root - Absolute project root.
 * @param specifiers - Plugin paths or package names, from config.
 * @returns The rules, in the order their plugins were listed.
 * @throws When a plugin cannot be imported or does not export rules.
 */
export async function loadPlugins(
  root: string,
  specifiers: string[],
): Promise<AnyRule[]> {
  const loaded: AnyRule[] = [];

  for (const specifier of specifiers) {
    const imported = await import(resolveSpecifier(root, specifier)).catch(
      (failure: unknown) => {
        throw new Error(
          `Cannot load plugin "${specifier}": ${
            failure instanceof Error ? failure.message : String(failure)
          }`,
        );
      },
    );

    const exported = (imported as { default?: PluginExport }).default;
    const rules = Array.isArray(exported) ? exported : [exported];
    if (rules.length === 0 || !rules.every(isRule)) {
      throw invalidPlugin(specifier);
    }
    loaded.push(...rules);
  }

  return loaded;
}

/**
 * Combines built-in and plugin rules, rejecting duplicate identifiers.
 *
 * @remarks A plugin silently shadowing a built-in would make config mean two
 * different things depending on load order. Renaming the plugin's rule is the
 * fix, and it costs one line.
 * @param builtIn - The rules shipped with this package.
 * @param plugins - The rules contributed by plugins.
 * @returns Every rule, built-ins first.
 * @throws When two rules claim the same id.
 */
export function mergeRules(builtIn: AnyRule[], plugins: AnyRule[]): AnyRule[] {
  const seen = new Set(builtIn.map((rule) => rule.id));
  const clashing = plugins.filter((rule) => seen.has(rule.id));

  if (clashing.length > 0) {
    throw new Error(
      `Plugin rule id(s) already taken by a built-in rule: ${clashing
        .map((rule) => rule.id)
        .join(", ")}\nRename the plugin's rule.`,
    );
  }

  const duplicated = plugins.filter(
    (rule, index) =>
      plugins.findIndex((other) => other.id === rule.id) !== index,
  );
  if (duplicated.length > 0) {
    throw new Error(
      `Two plugins define the same rule id: ${duplicated
        .map((rule) => rule.id)
        .join(", ")}`,
    );
  }

  return [...builtIn, ...plugins];
}
