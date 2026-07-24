/**
 * The built-in rule registry.
 *
 * @packageDocumentation
 */
import type { AnyRule } from "../core/rule.ts";
import { bannedPatterns } from "./banned-patterns.ts";
import { codegenDrift } from "./codegen-drift.ts";
import { envExampleSync } from "./env-example-sync.ts";
import { localeParity } from "./locale-parity.ts";
import { maxFileSize } from "./max-file-size.ts";
import { meaningfulNames } from "./meaningful-names.ts";
import { noConflictMarkers } from "./no-conflict-markers.ts";
import { noDeadDocLinks } from "./no-dead-doc-links.ts";
import { noDeprecatedApis } from "./no-deprecated-apis.ts";
import { preferArrayMethods } from "./prefer-array-methods.ts";
import { tsdocCoverage } from "./tsdoc-coverage.ts";

/**
 * Every rule this package ships, in the order they run.
 *
 * @remarks Ordered cheapest first, so a run that is going to fail on something
 * obvious says so before spending seconds in the type checker.
 */
export const BUILT_IN_RULES: AnyRule[] = [
  noConflictMarkers,
  maxFileSize,
  bannedPatterns,
  noDeadDocLinks,
  localeParity,
  envExampleSync,
  tsdocCoverage,
  meaningfulNames,
  preferArrayMethods,
  noDeprecatedApis,
  codegenDrift,
];
