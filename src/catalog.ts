/**
 * Emits the rule catalog: every built-in rule, its defaults and its options.
 *
 * @remarks Generated from the same zod schemas the loader validates against,
 * exactly like `schema.json`, so the catalog cannot drift from what the tool
 * accepts. Run via `npm run generate`; the output is committed so it ships
 * with the package and serves `vibator docs rules`.
 *
 * @packageDocumentation
 */
import { writeFileSync } from "node:fs";
import { z } from "zod";
import type { AnyRule } from "./core/rule.ts";
import { BUILT_IN_RULES } from "./rules/index.ts";

/** Longest rendered default before it is elided in favour of `schema.json`. */
const MAX_DEFAULT_LENGTH = 48;

/** One row of a rule's options table. */
interface OptionRow {
  /** Dotted option path, `patterns[].fix` style for array entries. */
  name: string;
  /** Human-readable type. */
  type: string;
  /** Rendered default value, when one exists. */
  defaultValue: string;
  /** What the option means, from the schema's own description. */
  description: string;
}

/** The slice of a JSON Schema node this generator reads. */
interface SchemaNode {
  /** The node's primitive type. */
  type?: string;
  /** Literal alternatives, for enums. */
  enum?: unknown[];
  /** Property nodes, for objects. */
  properties?: Record<string, SchemaNode>;
  /** Property names that must be present, for objects. */
  required?: string[];
  /** The element node, for arrays. */
  items?: SchemaNode;
  /** The declared default. */
  default?: unknown;
  /** The `.describe()` text. */
  description?: string;
}

/**
 * Renders a node's type for the table.
 *
 * @param node - The schema node.
 * @returns A compact human-readable type.
 */
function typeOf(node: SchemaNode): string {
  if (node.enum) {
    return node.enum.map((literal) => JSON.stringify(literal)).join(" or ");
  }
  if (node.type === "array") {
    return node.items ? `${typeOf(node.items)}[]` : "array";
  }
  return node.type ?? "unknown";
}

/**
 * Renders a node's default for the table.
 *
 * @param node - The schema node.
 * @param isRequired - Whether the parent object requires this property.
 * @returns The default as inline code, elided when too long to read.
 */
function defaultOf(node: SchemaNode, isRequired: boolean): string {
  if (node.default === undefined) return isRequired ? "required" : "(none)";
  const rendered = JSON.stringify(node.default);
  if (rendered.length <= MAX_DEFAULT_LENGTH) return `\`${rendered}\``;
  return "see `schema.json`";
}

/**
 * Builds the rows one property contributes: its own, then any nested ones.
 *
 * @param key - The property's name in its parent.
 * @param node - The property's schema node.
 * @param prefix - The path accumulated so far.
 * @param required - The parent's required property names.
 * @returns The property's row, followed by rows for nested fields.
 */
function propertyRows(
  key: string,
  node: SchemaNode,
  prefix: string,
  required: Set<string>,
): OptionRow[] {
  const name = prefix ? `${prefix}.${key}` : key;
  const row: OptionRow = {
    name,
    type: typeOf(node),
    defaultValue: defaultOf(node, required.has(key)),
    description: node.description ?? "",
  };
  const nested = node.items?.properties ? node.items : node;
  const nestedPrefix = node.items?.properties ? `${name}[]` : name;
  return nested.properties ? [row, ...rowsOf(nested, nestedPrefix)] : [row];
}

/**
 * Flattens an object node's properties into table rows.
 *
 * @param parent - The object node whose properties are rendered.
 * @param prefix - The path accumulated so far.
 * @returns One row per option, nested object and array fields included.
 */
function rowsOf(parent: SchemaNode, prefix = ""): OptionRow[] {
  const required = new Set(parent.required ?? []);
  return Object.entries(parent.properties ?? {}).flatMap(([key, node]) =>
    propertyRows(key, node, prefix, required),
  );
}

/**
 * Renders a rule's options table.
 *
 * @param rule - The rule whose schema is read.
 * @returns The Markdown table, or a stand-in when the rule has no options.
 */
function optionsTableOf(rule: AnyRule): string {
  const schema = z.toJSONSchema(rule.optionsSchema, {
    io: "input",
  }) as SchemaNode;
  const rows = rowsOf(schema);
  if (rows.length === 0) return "No options.\n";

  const rendered = rows.map(
    (row) =>
      `| \`${row.name}\` | ${row.type} | ${row.defaultValue} | ${row.description} |`,
  );
  return [
    "| Option | Type | Default | Purpose |",
    "|---|---|---|---|",
    ...rendered,
    "",
  ].join("\n");
}

/**
 * Renders one rule's catalog entry.
 *
 * @param rule - The rule to render.
 * @returns Its Markdown section.
 */
function entryOf(rule: AnyRule): string {
  const exclude = rule.defaultExclude ?? [];
  const globs = [
    `- Scope: ${rule.scope}. Default severity: \`${rule.defaultSeverity}\``,
    `- Default include: ${rule.defaultInclude.map((glob) => `\`${glob}\``).join(", ") || "none; configure to enable"}`,
    ...(exclude.length > 0
      ? [
          `- Default exclude: ${exclude.map((glob) => `\`${glob}\``).join(", ")}`,
        ]
      : []),
    `- Guideline: [${rule.docs}](./${rule.docs})`,
  ];
  return `## \`${rule.id}\`\n\n${rule.title}.\n\n${globs.join("\n")}\n\n${optionsTableOf(rule)}`;
}

/**
 * Writes the catalog next to the other documents.
 *
 * @returns Nothing; writes `docs/rule-catalog.md`.
 */
function main(): void {
  const header = `# Rule catalog

<!-- Generated by \`npm run generate\` from the rules' own schemas. Do not edit by hand. -->

Every built-in rule, its defaults, and every option it accepts. The config
file format is documented in [configuration.md](./configuration.md). The
reasoning behind each rule is in its linked guideline, also available as
\`vibator explain <rule>\`. Rules with a default severity of \`off\` require
their mandatory options before they can run.

`;
  const entries = BUILT_IN_RULES.map(entryOf).join("\n");
  writeFileSync(
    new URL("../docs/rule-catalog.md", import.meta.url),
    header + entries,
  );
  console.log(`Wrote docs/rule-catalog.md for ${BUILT_IN_RULES.length} rules.`);
}

main();
