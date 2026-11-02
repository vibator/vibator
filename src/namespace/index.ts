/**
 * The `vibator` namespace: the data access layer a rule reads from.
 *
 * @packageDocumentation
 */
import { git } from "./git/index.ts";
import { glob } from "./glob/index.ts";
import { ignore } from "./ignore/index.ts";
import { json } from "./json/index.ts";
import { module } from "./module/index.ts";
import { pkg } from "./package/index.ts";
import { project } from "./project/index.ts";
import { shell } from "./shell/index.ts";
import { text } from "./text/index.ts";
import { ts } from "./ts/index.ts";

export type { StatusEntry } from "./git/index.ts";
export type { PackageManifest } from "./package/index.ts";
export type { File, FileSet, Folder, FolderSet } from "./project/index.ts";
export type { ShellOptions, ShellResult } from "./shell/index.ts";
export type { Hit, Line, Match, Position } from "./text/index.ts";
export type { Ast, NodeCursor, Program } from "./ts/index.ts";

/**
 * The type of the `vibator` object. A plugin that adds a namespace declares it
 * here with `declare module "vibator" { interface Vibator { ... } }`.
 */
export interface Vibator {
  /** Navigate the files and folders in this project, and write to them. */
  project: typeof project;
  /** Parse and manipulate TypeScript files. */
  ts: typeof ts;
  /** Parse JSON files. */
  json: typeof json;
  /** Parse and manipulate files as plain text. */
  text: typeof text;
  /** Check ignore markers for a rule at line, node, or file level. */
  ignore: typeof ignore;
  /** Gateway to git functionality. */
  git: typeof git;
  /** Gateway to the shell. */
  shell: typeof shell;
  /** Parse and manage `package.json` files. */
  package: typeof pkg;
  /** Resolve module specifiers to files. */
  module: typeof module;
  /** Match paths against globs. */
  glob: typeof glob;
}

/**
 * The base vibator framework namespace.
 */
export const vibator: Vibator = {
  /** Navigate the files and folders in this project, and write to them. */
  project,
  /** Parse and manipulate TypeScript files. */
  ts,
  /** Parse JSON files. */
  json,
  /** Parse and manipulate files as plain text. */
  text,
  /** Check ignore markers for a rule at line, node, or file level. */
  ignore,
  /** Gateway to git functionality. */
  git,
  /** Gateway to the shell. */
  shell,
  /** Parse and manage `package.json` files. */
  package: pkg,
  /** Resolve module specifiers to files. */
  module,
  /** Match paths against globs. */
  glob,
};

/**
 * Adds a namespace to the `vibator` object, so every rule reads it as
 * `vibator.<name>`. A plugin calls it when its module is imported.
 *
 * @param name - The property name on `vibator`.
 * @param value - The namespace.
 * @returns The same namespace.
 * @throws When `vibator` already has a namespace with that name.
 */
export function defineNamespace<Value extends object>(
  name: string,
  value: Value,
): Value {
  if (Object.hasOwn(vibator, name)) {
    throw new Error(`Duplicate namespace: ${name}`);
  }
  Object.defineProperty(vibator, name, {
    value,
    enumerable: true,
    configurable: true,
  });
  return value;
}
