/**
 * The `object` namespace: utilities for plain objects.
 *
 * @packageDocumentation
 */

/**
 * Whether a value is a plain object, not an array.
 *
 * @param value - The value to inspect.
 * @returns Whether the value is a plain object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merges two values: objects merge by key, arrays and other values are
 * replaced by the override, and the override wins.
 *
 * @param base - The base value.
 * @param override - The value merged on top.
 * @returns The merged value.
 */
function mergeValues(base: unknown, override: unknown): unknown {
  if (!isObject(base) || !isObject(override)) return override;
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    if (key === "__proto__" || key === "constructor") continue;
    result[key] = mergeValues(result[key], override[key]);
  }
  return result;
}

/**
 * Utilities for plain objects.
 */
export const object = {
  /**
   * Deep-merges override onto base. Objects merge by key, arrays and other
   * values are replaced by override, and override wins.
   *
   * @param base - The base value.
   * @param override - The value merged on top.
   * @returns The merged value.
   */
  merge<T>(base: T, override: T): T {
    return mergeValues(base, override) as T;
  },
};
