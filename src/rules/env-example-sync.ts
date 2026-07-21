/**
 * Rule: the example env file matches what the code actually reads.
 *
 * @packageDocumentation
 */
import { z } from "zod";
import type { Diagnostic } from "../core/diagnostic.ts";
import type { ProjectRule, ProjectRuleInput } from "../core/rule.ts";

/** Options for {@link envExampleSync}. */
const optionsSchema = z.object({
  /** The file documenting every configurable variable. */
  example: z
    .string()
    .default(".env.example")
    .describe("The file documenting every configurable variable"),
  /**
   * Variables supplied by the runtime, the bundler or CI, which no operator
   * sets. Defaults cover Node and the values Vite injects into the browser.
   */
  ambient: z
    .array(z.string())
    .default([
      "NODE_ENV",
      "CI",
      "PATH",
      "HOME",
      "PROD",
      "DEV",
      "MODE",
      "SSR",
      "BASE_URL",
    ])
    .describe(
      "Variables the runtime, bundler or CI supplies, never documented",
    ),
  /** Variables consumed outside the scanned sources, such as by compose. */
  externallyConsumed: z
    .array(z.string())
    .default([])
    .describe(
      "Variables consumed outside the scanned sources, e.g. by compose",
    ),
  /** Whether to report documented variables that nothing reads. */
  reportUnread: z
    .boolean()
    .default(true)
    .describe("Whether to report documented variables that nothing reads"),
});

/** The resolved options this rule works from. */
type Options = z.infer<typeof optionsSchema>;

/**
 * The ways configuration is read, as patterns over source text.
 *
 * @remarks The third entry covers `envNumber("NAME", fallback)` style helpers;
 * the last two cover the Deno and Bun runtimes. Matching is textual, so a name
 * assembled at runtime from a prefix is missed — spelling variable names out
 * in full is what keeps this rule honest.
 */
const READ_PATTERNS: readonly RegExp[] = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\]/g,
  /\benv[A-Za-z]*\(\s*["'`]([A-Z][A-Z0-9_]*)["'`]/g,
  /import\.meta\.env\.([A-Z][A-Z0-9]+[A-Z0-9_]*)/g,
  /Deno\.env\.get\(\s*["'`]([A-Z][A-Z0-9_]*)["'`]/g,
  /Bun\.env\.([A-Z][A-Z0-9_]*)/g,
];

/**
 * Finds names pulled out of the environment by destructuring.
 *
 * @remarks `const { API_URL, PORT = "3000" } = process.env` is the single most
 * common access pattern in Node code and matches none of the single-name
 * patterns, so it gets its own scan. Renames (`NAME: alias`) count under the
 * environment-side name, and only conventional ALL_CAPS names are taken — a
 * lowercase binding in the list is someone destructuring something else.
 * @param text - The source text, comments already stripped.
 * @returns The environment names the destructuring reads.
 */
function destructuredReads(text: string): string[] {
  const bindings = [
    ...text.matchAll(
      /\{([^{}]*)\}\s*=\s*(?:process\.env|import\.meta\.env|Bun\.env)\b/g,
    ),
  ];
  return bindings
    .flatMap((match) => (match[1] ?? "").split(","))
    .map((entry) => entry.split(/[:=]/)[0]?.trim() ?? "")
    .filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name));
}

/**
 * Removes comments before scanning for variable reads.
 *
 * @remarks Documentation routinely names variables it does not read — a doc
 * block explaining `import.meta.env.VITE_*` is prose, not a configuration
 * read, and reporting it sends people looking for a variable that does not
 * exist.
 * @param text - The source text.
 * @returns The text with block and line comments blanked out.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * The variable names an example file documents.
 *
 * @remarks Three forms count: a live `NAME=value`, a commented `# NAME=value`
 * showing a default, and a name leading an aligned comment table. The column
 * gap in the third is what separates a documented knob from prose that happens
 * to start with a capitalised word.
 * @param text - Contents of the example file.
 * @returns The documented names.
 */
function documentedVariables(text: string): Set<string> {
  const assigned = [...text.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]{2,})\s*=/gm)];
  const described = [...text.matchAll(/^\s*#\s+([A-Z][A-Z0-9_]{2,})\s{2,}/gm)];
  return new Set(
    [...assigned, ...described].map((match) => match[1] as string),
  );
}

/**
 * Scans the sources for configuration reads.
 *
 * @param files - The files to scan.
 * @param context - Shared resources.
 * @returns Variable names mapped to the first file reading each.
 */
function collectReads(
  files: string[],
  context: ProjectRuleInput<unknown>["context"],
): Map<string, string> {
  const readBy = new Map<string, string>();
  files.forEach((file, index) => {
    const text = stripComments(context.read(file));
    const direct = READ_PATTERNS.flatMap((pattern) =>
      [...text.matchAll(pattern)].map((match) => match[1]),
    );
    [...direct, ...destructuredReads(text)].forEach((name) => {
      if (name && !readBy.has(name)) readBy.set(name, file);
    });
    context.progress(index + 1, files.length);
  });
  return readBy;
}

/**
 * Reports variables the code reads but the example file omits.
 *
 * @param readBy - Variables mapped to the file reading each.
 * @param documented - Names the example file documents.
 * @param options - The rule's options.
 * @returns One diagnostic per undocumented read.
 */
function undocumentedReads(
  readBy: Map<string, string>,
  documented: Set<string>,
  options: Options,
): Diagnostic[] {
  const ambient = new Set(options.ambient);
  return [...readBy]
    .filter(([name]) => !documented.has(name) && !ambient.has(name))
    .map(([name, file]) => ({
      file: options.example,
      message: `${name} is read by ${file} but not documented here`,
      expected: `Every variable the code reads appears in ${options.example}`,
      fix: `Add ${name}, with a comment describing what it does and its default`,
    }));
}

/**
 * Reports documented variables nothing reads.
 *
 * @param readBy - Variables mapped to the file reading each.
 * @param documented - Names the example file documents.
 * @param options - The rule's options.
 * @returns One diagnostic per unread entry, or none when disabled.
 */
function unreadDocumentation(
  readBy: Map<string, string>,
  documented: Set<string>,
  options: Options,
): Diagnostic[] {
  if (!options.reportUnread) return [];
  const external = new Set(options.externallyConsumed);
  return [...documented]
    .filter((name) => !readBy.has(name) && !external.has(name))
    .map((name) => ({
      file: options.example,
      message: `${name} is documented here but read by no scanned source`,
      expected: "Documented variables are ones the code actually reads",
      fix: `Remove ${name}, or list it under this rule's "externallyConsumed" option if a compose file or entrypoint consumes it`,
    }));
}

/**
 * Reads the example file, if there is one.
 *
 * @param context - Shared resources.
 * @param example - Repo-relative path of the example file.
 * @returns Its contents, or `undefined` when the file does not exist.
 */
function readExample(
  context: ProjectRuleInput<unknown>["context"],
  example: string,
): string | undefined {
  try {
    return context.read(example);
  } catch {
    return undefined;
  }
}

/**
 * Flags drift between the code's configuration reads and its documentation.
 *
 * @remarks An undocumented variable is one a production deploy silently runs
 * without; a documented one nothing reads is one operators keep setting for no
 * reason. Both directions rot, and nothing else links the two.
 */
export const envExampleSync: ProjectRule<Options> = {
  id: "env-example-sync",
  title: "The example env file matches what the code reads",
  docs: "rules/env-example-sync.md",
  scope: "project",
  defaultSeverity: "warn",
  defaultInclude: ["**/src/**/*.{ts,tsx,js,jsx}"],
  defaultExclude: ["**/*.test.*", "**/*.spec.*"],
  optionsSchema,

  check({ files, options, context }): Diagnostic[] {
    if (files.length === 0) return [];

    const readBy = collectReads(files, context);
    const example = readExample(context, options.example);

    if (example === undefined) {
      // No example file at all. That is only a problem if the code reads
      // configuration — a project with none simply has nothing to document.
      return [...readBy].map(([name, file]) => ({
        message: `${name} is read by ${file}, but ${options.example} does not exist`,
        expected: `A ${options.example} documenting every variable a deployment must supply`,
        fix: `Create ${options.example} and add ${name} to it`,
      }));
    }

    const documented = documentedVariables(example);
    return [
      ...undocumentedReads(readBy, documented, options),
      ...unreadDocumentation(readBy, documented, options),
    ];
  },
};
