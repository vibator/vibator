/**
 * Emits the JSON Schema for `vibator.json`.
 *
 * @remarks Generated from the same zod schemas the loader validates against and
 * from the rules' own option schemas, so editor autocomplete cannot drift from
 * what the tool accepts. Run `npm run generate` after changing either.
 *
 * @packageDocumentation
 */
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { BUILT_IN_RULES } from "./rules/index.ts";

/**
 * Builds the schema for a single rule's entry.
 *
 * @param ruleId - The rule's identifier.
 * @returns A schema accepting a bare severity or a settings block.
 */
function ruleEntrySchema(ruleId: string): z.ZodType {
  const rule = BUILT_IN_RULES.find((entry) => entry.id === ruleId);
  const block = z.object({
    severity: z.enum(["error", "warn", "off"]).optional(),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    options: (rule?.optionsSchema ?? z.unknown()).optional(),
    docs: z.string().optional(),
  });
  return z.union([
    z.enum(["error", "warn", "off"]),
    block,
    z.array(block).min(1),
  ]);
}

/**
 * Builds the schema for the config file as a whole.
 *
 * @param rules - Entry schemas keyed by rule id.
 * @returns The schema describing every field `vibator.json` accepts.
 */
function configFileSchema(rules: Record<string, z.ZodType>): z.ZodType {
  return z.object({
    $schema: z.string().optional(),
    extends: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe(
        "Configs this one builds on: a path starting with . or a package specifier. " +
          "Later entries win; this file wins over all of them.",
      ),
    recommended: z
      .boolean()
      .optional()
      .describe(
        "Whether rules this config never names run at their own default severity. " +
          "True by default; set false to run only the rules listed here.",
      ),
    plugins: z
      .array(z.string())
      .optional()
      .describe("Paths or package names of modules contributing rules"),
    rules: z.object(rules).partial().optional(),
    guidelines: z.record(z.string(), z.array(z.string())).optional(),
  });
}

/**
 * Writes the schema next to the package manifest.
 *
 * @returns Nothing; writes `schema.json`.
 */
function main(): void {
  const rules = Object.fromEntries(
    BUILT_IN_RULES.map((rule) => [
      rule.id,
      ruleEntrySchema(rule.id).describe(rule.title),
    ]),
  );

  writeFileSync(
    new URL("../schema.json", import.meta.url),
    `${JSON.stringify(z.toJSONSchema(configFileSchema(rules), { io: "input" }), null, 2)}\n`,
  );
  console.log(`Wrote schema.json for ${BUILT_IN_RULES.length} rules.`);
}

main();
