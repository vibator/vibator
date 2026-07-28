/**
 * The shared reporter type.
 *
 * @packageDocumentation
 */
import type { Finding } from "../../engine/finding.ts";

/**
 * Renders findings as text for one output format.
 *
 * @param findings - The findings of the run.
 * @returns The rendered output.
 */
export type Reporter = (findings: Finding[]) => string;
