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
 * Imports every rule module in a folder, registering the rules they define.
 *
 * @param dir - The absolute folder path.
 */
async function importFolder(dir: string): Promise<void> {
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((name) => /\.(ts|js|mjs)$/.test(name));
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
