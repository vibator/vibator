/**
 * Rule: every locale carries the same keys as the source locale.
 *
 * @packageDocumentation
 */
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { Diagnostic } from "../core/diagnostic.ts";
import type { ProjectRule, ProjectRuleInput } from "../core/rule.ts";

/** Longest key list printed per namespace before the rest is summarised. */
const MAX_REPORTED_KEYS = 8;

/** Options for {@link localeParity}. */
const optionsSchema = z
  .object({
    /** Directory holding the locale catalogs. */
    root: z.string().describe("Directory holding the locale catalogs"),
    /** The locale every other is seeded from. */
    source: z
      .string()
      .default("en")
      .describe("The locale every other is seeded from"),
    /**
     * How the catalogs are laid out. `directory-per-locale` expects
     * `root/<locale>/<namespace>.json`; `file-per-locale` expects
     * `root/<locale>.json`.
     */
    layout: z
      .enum(["directory-per-locale", "file-per-locale"])
      .default("directory-per-locale")
      .describe(
        "directory-per-locale expects root/<locale>/<namespace>.json; " +
          "file-per-locale expects root/<locale>.json",
      ),
    /** The locales to check; discovered from the layout when omitted. */
    locales: z
      .array(z.string())
      .optional()
      .describe(
        "The locales to check; discovered from the layout when omitted",
      ),
  })
  .strict();

/** The resolved options this rule works from. */
type Options = z.infer<typeof optionsSchema>;

/** The rule input, shortened for the helpers below. */
type Input = ProjectRuleInput<Options>;

/** A translation namespace, nested to any depth. */
type TranslationTree = { [key: string]: string | TranslationTree };

/**
 * Flattens a nested namespace into dotted key paths.
 *
 * @param tree - The parsed namespace.
 * @param prefix - The path accumulated so far.
 * @returns Every leaf key path.
 */
function flattenKeys(tree: TranslationTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null
      ? flattenKeys(value, path)
      : [path];
  });
}

/**
 * Renders a key list, truncated so one bad namespace cannot bury the others.
 *
 * @param keys - The offending key paths.
 * @returns A comma-separated excerpt with a count of anything omitted.
 */
function summarise(keys: string[]): string {
  const shown = keys.slice(0, MAX_REPORTED_KEYS).join(", ");
  const hidden = keys.length - MAX_REPORTED_KEYS;
  return hidden > 0 ? `${shown} (+${hidden} more)` : shown;
}

/**
 * Reads and parses one catalog file.
 *
 * @param context - Shared resources, used for its memoized reads.
 * @param path - Repo-relative path of the catalog file.
 * @returns The parsed tree, or `undefined` when absent or malformed.
 */
function readCatalog(
  context: Input["context"],
  path: string,
): TranslationTree | undefined {
  try {
    return JSON.parse(context.read(path)) as TranslationTree;
  } catch {
    return undefined;
  }
}

/**
 * Turns a pair of key differences into diagnostics.
 *
 * @param path - The catalog file being reported.
 * @param sourceLabel - The source catalog it was compared against.
 * @param missing - Keys the source has and this locale does not.
 * @param extra - Keys this locale has and the source does not.
 * @returns One diagnostic per non-empty difference.
 */
function keyDifferences(
  path: string,
  sourceLabel: string,
  missing: string[],
  extra: string[],
): Diagnostic[] {
  return [
    ...(missing.length > 0
      ? [
          {
            file: path,
            message: `${missing.length} key(s) missing vs ${sourceLabel}: ${summarise(missing)}`,
            expected: `Every key in ${sourceLabel}`,
            fix: "Add the missing keys, seeded with the source text until translated",
          },
        ]
      : []),
    ...(extra.length > 0
      ? [
          {
            file: path,
            message: `${extra.length} key(s) absent from ${sourceLabel}: ${summarise(extra)}`,
            expected: `No keys beyond those in ${sourceLabel}`,
            fix: "Remove them, or add them to the source locale; this is usually a half-applied rename",
          },
        ]
      : []),
  ];
}

/**
 * Compares one locale catalog against the source's keys.
 *
 * @param context - Shared resources.
 * @param path - Repo-relative path of the locale's catalog.
 * @param sourceLabel - Display name of the source catalog.
 * @param sourcePath - Repo-relative path of the source catalog, for the fix.
 * @param sourceKeys - The key paths the source defines.
 * @returns The findings for that catalog.
 */
function compareCatalog(
  context: Input["context"],
  path: string,
  sourceLabel: string,
  sourcePath: string,
  sourceKeys: string[],
): Diagnostic[] {
  const tree = readCatalog(context, path);
  if (!tree) {
    return [
      {
        file: path,
        message: "Catalog missing or unparsable for this locale",
        expected: `A valid JSON catalog matching ${sourceLabel}`,
        fix: `Copy ${sourcePath} to ${path} and translate it`,
      },
    ];
  }

  const localeKeys = new Set(flattenKeys(tree));
  const sourceKeySet = new Set(sourceKeys);
  return keyDifferences(
    path,
    sourceLabel,
    sourceKeys.filter((key) => !localeKeys.has(key)),
    [...localeKeys].filter((key) => !sourceKeySet.has(key)),
  );
}

/**
 * The locales present under the configured root, per the layout.
 *
 * @param options - The rule's options.
 * @param absoluteRoot - Absolute path of the locales root.
 * @returns Locale codes, ignoring loose files such as a README.
 */
function discoverLocales(options: Options, absoluteRoot: string): string[] {
  if (options.locales) return options.locales;
  if (options.layout === "file-per-locale") {
    return readdirSync(absoluteRoot)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => entry.slice(0, -".json".length));
  }
  return readdirSync(absoluteRoot).filter((entry) =>
    statSync(join(absoluteRoot, entry)).isDirectory(),
  );
}

/**
 * Checks every locale laid out as one file per locale.
 *
 * @param input - The rule input.
 * @param locales - The locales to check, source excluded.
 * @returns The findings.
 */
function checkFileLayout(input: Input, locales: string[]): Diagnostic[] {
  const { options, context } = input;
  const sourcePath = `${options.root}/${options.source}.json`;
  const sourceKeys = flattenKeys(readCatalog(context, sourcePath) ?? {});

  return locales.flatMap((locale, index) => {
    context.progress(index + 1, locales.length);
    return compareCatalog(
      context,
      `${options.root}/${locale}.json`,
      `${options.source}.json`,
      sourcePath,
      sourceKeys,
    );
  });
}

/**
 * Checks every locale laid out as one directory per locale.
 *
 * @param input - The rule input.
 * @param locales - The locales to check, source excluded.
 * @returns The findings.
 */
function checkDirectoryLayout(input: Input, locales: string[]): Diagnostic[] {
  const { options, context } = input;
  const namespaces = readdirSync(
    resolve(context.root, options.root, options.source),
  ).filter((entry) => entry.endsWith(".json"));

  const sourceKeys = new Map(
    namespaces.map((namespace) => {
      const path = `${options.root}/${options.source}/${namespace}`;
      return [namespace, flattenKeys(readCatalog(context, path) ?? {})];
    }),
  );

  return locales.flatMap((locale, index) => {
    context.progress(index + 1, locales.length);
    return namespaces.flatMap((namespace) =>
      compareCatalog(
        input.context,
        `${options.root}/${locale}/${namespace}`,
        `${options.source}/${namespace}`,
        `${options.root}/${options.source}/${namespace}`,
        sourceKeys.get(namespace) ?? [],
      ),
    );
  });
}

/**
 * Flags locales that have drifted from the source language.
 *
 * @remarks Typed translation keys prove a key exists in the source locale;
 * nothing proves it was seeded to the others. A key added to one locale alone
 * silently falls back at runtime for every other language.
 */
export const localeParity: ProjectRule<Options> = {
  id: "locale-parity",
  title: "Every locale carries the same keys as the source",
  docs: "rules/locale-parity.md",
  scope: "project",
  // Off until configured: this rule cannot do anything without options, so
  // running it by default would fail a fresh project rather than help it.
  defaultSeverity: "off",
  defaultInclude: [],
  optionsSchema,

  check(input): Diagnostic[] {
    const { options, context } = input;
    const absoluteRoot = resolve(context.root, options.root);

    let locales: string[];
    try {
      locales = discoverLocales(options, absoluteRoot).filter(
        (locale) => locale !== options.source,
      );
    } catch {
      return [
        {
          message: `Locales root "${options.root}" cannot be read`,
          expected: "The rule's root option names the locales directory",
          fix: `Point this rule's "root" option at the directory holding the catalogs, or turn the rule off`,
        },
      ];
    }

    try {
      return options.layout === "file-per-locale"
        ? checkFileLayout(input, locales)
        : checkDirectoryLayout(input, locales);
    } catch {
      return [
        {
          message: `Source locale "${options.source}" cannot be read under ${options.root}`,
          expected: "A source catalog every other locale is compared against",
          fix: `Check the "source" and "layout" options against the actual layout of ${options.root}`,
        },
      ];
    }
  },
};
