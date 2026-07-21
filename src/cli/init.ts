/**
 * The `init` subcommand: a valid starting config and a map of what to do next.
 *
 * @packageDocumentation
 */
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { packageRoot, packageVersion } from "../core/package-root.ts";
import type { AnyRule } from "../core/rule.ts";

/**
 * The `$schema` value that will actually resolve for this install.
 *
 * @remarks `./node_modules/vibator/schema.json` is checked rather than
 * assumed: pnpm and npm lay the package out there, but Yarn PnP has no
 * `node_modules` at all. When the local path will not resolve, the published
 * schema is referenced by version over HTTPS, which every editor accepts.
 * @param root - Absolute project root.
 * @returns A schema reference valid for this project's layout.
 */
function schemaReference(root: string): string {
  const local = "./node_modules/vibator/schema.json";
  if (existsSync(resolve(root, local))) return local;
  if (existsSync(join(packageRoot, "schema.json"))) {
    return `https://unpkg.com/vibator@${packageVersion()}/schema.json`;
  }
  return local;
}

/**
 * Writes a starter `vibator.json`.
 *
 * @remarks Deliberately minimal: every rule already runs at its own default
 * severity with no config at all, so the starter only wires up editor
 * validation and leaves the tuning to the reader — or to an agent following
 * the `configuring-vibator` skill, which knows how to discover the options
 * the off-by-default rules need.
 * @param root - Absolute project root.
 * @param rules - Every registered rule, for the closing guidance.
 * @returns Nothing; refuses to overwrite an existing config.
 */
export function init(root: string, rules: AnyRule[]): void {
  const target = resolve(root, "vibator.json");
  if (existsSync(target) || existsSync(resolve(root, ".vibator.json"))) {
    console.error("A vibator config already exists here; not touching it.");
    process.exitCode = 1;
    return;
  }

  const starter = {
    $schema: schemaReference(root),
    rules: {},
  };
  writeFileSync(target, `${JSON.stringify(starter, null, 2)}\n`);

  const needingOptions = rules
    .filter((rule) => rule.defaultSeverity === "off")
    .map((rule) => rule.id);

  console.log(`Wrote vibator.json.

Every rule already runs at its default severity — configure only what differs.
Off until configured (each needs project-specific options):
${needingOptions.map((id) => `  ${id}`).join("\n")}

Next steps:
  vibator list                 see every rule
  vibator explain <rule>       read the standard behind one
  vibator docs configuration   the full config reference
  vibator skills --install     give coding agents the configuring and
                               rule-authoring skills`);
}
