/**
 * The json reporter: the machine-readable format.
 *
 * @packageDocumentation
 */
import type { Reporter } from "./reporter.ts";

/**
 * The machine-readable format, for a direct integration.
 *
 * @param findings - The findings of the run.
 * @returns The rendered JSON.
 */
export const json: Reporter = (findings) =>
  JSON.stringify({ findings }, null, 2);
