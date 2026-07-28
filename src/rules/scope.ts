/**
 * The shared include/exclude options fragment.
 *
 * @packageDocumentation
 */
import { z } from "zod";

/**
 * A prebuilt options fragment for file scope. A rule extends it in its
 * `options` to expose `include` and `exclude` with shared defaults.
 */
export const scope = z.object({
  /** Glob patterns selecting the files the rule judges. */
  include: z
    .array(z.string())
    .default(["**/*.{ts,tsx,js,jsx,mjs,cjs}"])
    .describe("Glob patterns selecting the files the rule judges"),
  /** Glob patterns removed from that selection. */
  exclude: z
    .array(z.string())
    .default(["**/*.test.*", "**/*.spec.*"])
    .describe("Glob patterns removed from that selection"),
});
