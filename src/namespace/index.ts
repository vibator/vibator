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
import { object } from "./object/index.ts";
import { pkg } from "./package/index.ts";
import { project } from "./project/index.ts";
import { shell } from "./shell/index.ts";
import { text } from "./text/index.ts";
import { ts } from "./ts/index.ts";

export type { StatusEntry } from "./git/index.ts";
export type { PackageManifest } from "./package/index.ts";
export type { File, FileSet, Folder, FolderSet } from "./project/index.ts";
export type { ShellOptions, ShellResult } from "./shell/index.ts";
export type { Line, Match, Position } from "./text/index.ts";
export type { Ast, NodeCursor, Program } from "./ts/index.ts";

/**
 * The base vibator framework namespace.
 */
export const vibator = {
  /** Navigate the files and folders in this project, and write to them. */
  project,
  /** Parse and manipulate TypeScript files. */
  ts,
  /** Parse JSON files. */
  json,
  /** Utilities for plain objects. */
  object,
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
