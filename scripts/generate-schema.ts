/**
 * Emits `schema.json` from the configuration schema.
 *
 * @packageDocumentation
 */
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { configSchema } from "../src/configuration/index.ts";

writeFileSync(
  "schema.json",
  `${JSON.stringify(z.toJSONSchema(configSchema), null, 2)}\n`,
);
