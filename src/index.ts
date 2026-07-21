/**
 * Public API, for embedding the engine or adding rules of your own.
 *
 * @packageDocumentation
 */
export {
  type Config,
  loadConfig,
  type ResolvedRule,
  resolveRules,
} from "./core/config.ts";
export { createContext, type RuleContext } from "./core/context.ts";
export { defineRule } from "./core/define-rule.ts";
export {
  type Diagnostic,
  type GuidelineReference,
  locationOf,
  type ReportedDiagnostic,
  type Severity,
} from "./core/diagnostic.ts";
export { changedFiles, discover, stagedFiles } from "./core/discovery.ts";
export {
  type EventSink,
  type RuleResult,
  type RunEvent,
  type RunOptions,
  type RunResult,
  run,
} from "./core/engine.ts";
export { hasLineIgnoreAbove } from "./core/ignore.ts";
export { loadPlugins, mergeRules } from "./core/plugins.ts";
export type {
  AnyRule,
  FileRule,
  FileRuleInput,
  ProjectRule,
  ProjectRuleInput,
  Rule,
} from "./core/rule.ts";
export { jsonReporter } from "./reporters/json.ts";
export { prettyReporter } from "./reporters/pretty.ts";
export { BUILT_IN_RULES } from "./rules/index.ts";
