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

  const configSchema = z.object({
    $schema: z.string().optional(),
    plugins: z
      .array(z.string())
      .optional()
      .describe("Paths or package names of modules contributing rules"),
    rules: z.object(rules).partial().optional(),
    guidelines: z.record(z.string(), z.array(z.string())).optional(),
  });

  writeFileSync(
    new URL("../schema.json", import.meta.url),
    `${JSON.stringify(z.toJSONSchema(configSchema, { io: "input" }), null, 2)}\n`,
  );
  console.log(`Wrote schema.json for ${BUILT_IN_RULES.length} rules.`);
}

main();
