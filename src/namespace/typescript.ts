/**
 * Lazy TypeScript loader, keeping it an optional peer.
 *
 * @packageDocumentation
 */
import { createRequire } from "node:module";

let cached: typeof import("typescript") | undefined;

/**
 * Loads TypeScript on first use.
 *
 * @returns The TypeScript module.
 */
export function loadTypeScript(): typeof import("typescript") {
  if (!cached) {
    cached = createRequire(import.meta.url)("typescript");
  }
  return cached as typeof import("typescript");
}
