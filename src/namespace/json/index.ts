/**
 * The `json` namespace: parse JSON files.
 *
 * @packageDocumentation
 */
import type { File } from "../project/index.ts";

/**
 * Flattens a value into its dotted key paths, from a prefix.
 *
 * @param value - The value to flatten.
 * @param prefix - The dotted path accumulated so far.
 * @returns The dotted key paths beneath the value.
 */
function flatten(value: unknown, prefix: string): string[] {
  if (value === null || typeof value !== "object") {
    return prefix === "" ? [] : [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    return flatten(child, path);
  });
}

/**
 * Parse JSON files.
 */
export const json = {
  /**
   * Parses a JSON file into its value.
   *
   * @param file - The JSON file to parse.
   * @returns The parsed value, or `undefined` when the content is not valid JSON.
   */
  parse(file: File): unknown {
    try {
      return JSON.parse(file.content);
    } catch {
      return undefined;
    }
  },

  /**
   * Flattens a value into its dotted key paths.
   *
   * @param value - The value to flatten.
   * @returns Every dotted key path.
   */
  keys(value: unknown): string[] {
    return flatten(value, "");
  },
};
