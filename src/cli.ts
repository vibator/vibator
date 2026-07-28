#!/usr/bin/env node
/**
 * The vibator binary.
 *
 * @packageDocumentation
 */
import { main } from "./cli/index.ts";

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  },
);
