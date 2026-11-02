/**
 * Loads the rules for a run: the `.vibator/` folder and the configured plugins.
 * Importing a module registers the rules it defines.
 *
 * @packageDocumentation
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Config } from "../configuration/index.ts";
import { module } from "../namespace/module/index.ts";
import { requireRoot } from "../namespace/runtime.ts";
import { type AnyRule, definedRules } from "../rules/define-rule.ts";

/**
 * Reports whether a file name in `.vibator/` is a rule module: a `.ts`, `.js`,
 * or `.mjs` file that is not a test, a spec, or a declaration file.
 *
 * @param name - The file name.
 * @returns Whether the file is a rule module.
 */
function isRuleModule(name: string): boolean {
  return (
    /\.(ts|js|mjs)$/.test(name) &&
    !/\.(test|spec)\.\w+$/.test(name) &&
    !name.endsWith(".d.ts")
  );
}

/**
 * Imports every rule module at the top of a folder, registering the rules they
 * define. Subfolders hold helpers and are not imported.
 *
 * @param dir - The absolute folder path.
 */
async function importFolder(dir: string): Promise<void> {
  let entries: string[];
  try {
    entries = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && isRuleModule(entry.name))
      .map((entry) => entry.name);
  } catch {
    return; // no folder is fine
  }
  for (const name of entries) {
    await import(pathToFileURL(join(dir, name)).href);
  }
}

/**
 * Loads the rules for a run and returns the registered set.
 *
 * @param config - The loaded configuration.
 * @returns Every registered rule.
 */
export async function loadRules(config: Config): Promise<AnyRule[]> {
  const root = requireRoot();
  await importFolder(join(root, ".vibator"));
  for (const specifier of config.plugins ?? []) {
    const file = module.resolve(specifier, join(root, "package.json"));
    await import(pathToFileURL(file).href);
  }
  return definedRules();
}
