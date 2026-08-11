# `vibator` namespace

This document is the reference of the `vibator` namespace and all its
subnamespaces, properties, and functions as they are provided by the base
vibator framework.

## Namespaces

- [project](#project) — Navigate the files and folders in this project.
- [ts](#ts) — Parse and manipulate TypeScript files.
- [json](#json) — Parse JSON files.
- [object](#object) — Utilities for plain objects.
- [text](#text) — Parse and manipulate files as plain text.
- [ignore](#ignore) — Check ignore markers for a rule at line, node, or file level.
- [git](#git) — Gateway to git functionality.
- [shell](#shell) — Gateway to the shell.
- [package](#package) — Parse and manage `package.json` files.
- [module](#module) — Resolve module specifiers to files.
- [glob](#glob) — Match paths against globs.

---

## project

Navigate the files and folders in this project, and write to them.

| Declaration                             | Description                                                             |
|-----------------------------------------|-------------------------------------------------------------------------|
| root: string                            | The absolute path of the project root.                                  |
| files: [FileSet](#fileset)              | Every file in scope for the current run.                                |
| folders: [FolderSet](#folderset)        | Every top-level folder in the project.                                  |
| write(path: string, content: string): void | Writes content to an absolute path, creating the file when the path is new and overwriting it when the path exists. |

## ts

Parse and manipulate TypeScript files.

| Declaration                                           | Description                                                |
|-------------------------------------------------------|------------------------------------------------------------|
| parse(file: [File](#file)): [Ast](#ast)               | Parses a TypeScript or JavaScript file into a syntax tree. |
| program(tsconfig: [File](#file)): [Program](#program) | Builds a type-checked program from a `tsconfig` file.      |

## json

Parse JSON files.

| Declaration                         | Description                                 |
|-------------------------------------|---------------------------------------------|
| parse(file: [File](#file)): unknown | Parses a JSON file into its value.          |
| keys(value: unknown): string[]      | Flattens a value into its dotted key paths. |

## object

Utilities for plain objects.

| Declaration | Description |
|---|---|
| merge(base: T, override: T): T | Deep-merges override onto base; objects merge by key, arrays and other values are replaced, and override wins. |

## text

Parse and manipulate files as plain text.

| Declaration                                                            | Description                                                                                       |
|------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| lines(file: [File](#file)): [Line](#line)[]                            | Splits a file into numbered lines.                                                                |
| maskComments(file: [File](#file)): string                              | Returns the file content with JavaScript and TypeScript comments blanked, keeping line positions. |
| maskCode(file: [File](#file)): string                                  | Returns the file content with Markdown code fences and spans blanked, keeping line positions.     |
| positionAt(file: [File](#file), offset: number): [Position](#position) | Resolves a character offset to a line and column.                                                 |
| matches(file: [File](#file), pattern: RegExp): [Match](#match)[]       | Returns every match of a pattern with its position.                                               |
| binary(file: [File](#file)): boolean                                   | Reports whether the file content is binary.                                                       |

## ignore

Check whether an ignore marker silences a rule. A marker reads
`vibator-ignore <rule-id>: <reason>` on the line above the finding, or
`vibator-ignore-file <rule-id>: <reason>` anywhere in the file. The reason is
optional.

| Declaration | Description |
|---|---|
| line(file: [File](#file), line: number, rule: string): boolean | Reports whether a marker on the line above names the rule. |
| node(node: [Node](#external-types), rule: string): boolean | Reports whether a marker above the node or an enclosing class, function, method, interface, enum, or module names the rule. |
| file(file: [File](#file), rule: string): boolean | Reports whether a file-level marker names the rule. |

## git

Gateway to git functionality.

| Declaration                                            | Description                                                          |
|--------------------------------------------------------|----------------------------------------------------------------------|
| isRepo(): boolean                                      | Reports whether the project root sits inside a git repository.       |
| files(): string[]                                      | The tracked and untracked-tracked-eligible paths git keeps.          |
| untrackedFiles(): string[]                             | The untracked paths git keeps.                                       |
| changedFiles(): string[]                               | The paths this working tree changed against `HEAD`, present on disk. |
| stagedFiles(): string[]                                | The paths staged for the next commit, present on disk.               |
| changedSince(base: string): string[]                   | The paths this branch changed since it diverged from `base`.         |
| status(paths: string[]): [StatusEntry](#statusentry)[] | The working-tree status of the given paths.                          |
| restore(paths: string[]): void                         | Restores the given tracked paths from the index.                     |

## shell

Gateway to the shell.

| Declaration                                                                               | Description                             |
|-------------------------------------------------------------------------------------------|-----------------------------------------|
| run(command: string, options: [ShellOptions](#shelloptions)): [ShellResult](#shellresult) | Runs a command and returns its outcome. |

## package

Parse and manage `package.json` files.

| Declaration                                                     | Description                                   |
|-----------------------------------------------------------------|-----------------------------------------------|
| root: [PackageManifest](#packagemanifest)                       | The parsed root `package.json`.               |
| parse(file: [File](#file)): [PackageManifest](#packagemanifest) | Parses a `package.json` file into a manifest. |

## module

Resolve module references and specifiers to files.

| Declaration | Description |
|---|---|
| resolve(specifier: string, from?: string): string | Resolves a reference to an absolute file path, from `from`. |

The four reference forms, in resolution order:

| Form | Example | Meaning |
|---|---|---|
| Absolute path | `/abs/biome.json` | The path as it is. |
| `package:path` | `@vibator/gate:biome.base.json` | The file inside the installed package, ignoring its `exports` map. |
| Starts with `.` | `./biome.json`, `.vibator/biome.json` | A local file, joined onto the directory of `from`. |
| Anything else | `zod`, `@vibator/gate/biome` | A package specifier resolved by Node, honoring the `exports` map. |

## glob

Match paths against globs; prefix a glob with `!` to exclude.

| Declaration | Description |
|---|---|
| matches(path: string, globs: string \| string[]): boolean | Whether the path matches the globs and none of the exclusions. |

---

## Types

The objects returned and accepted across the namespaces above.

### FileSet

An ordered collection of files, with glob filtering and lookup by path.

| Declaration                                                         | Description                                          |
|---------------------------------------------------------------------|------------------------------------------------------|
| match(glob: string \| string[]): [FileSet](#fileset)                | Filters the set to files matching the glob or globs. |
| get(path: string): [File](#file)                                    | The file at an absolute path.                    |
| length: number                                                      | The count of files in the set.                       |
| forEach(visit: (file: [File](#file), index: number) => void): void  | Runs a function over each file in order.             |
| map(transform: (file: [File](#file), index: number) => T): T[]      | Maps each file to a value.                           |
| filter(keep: (file: [File](#file)) => boolean): [FileSet](#fileset) | Returns the files that satisfy a predicate.          |
| find(match: (file: [File](#file)) => boolean): [File](#file) \| undefined | Returns the first file that satisfies a predicate.   |
| paths(): string[]                                                   | The absolute paths in the set, sorted.          |

### File

One file in the project.

| Declaration     | Description                              |
|-----------------|------------------------------------------|
| path: string    | The absolute path, forward-slashed. |
| name: string    | The file base name.                      |
| ext: string     | The file extension, including the dot.   |
| content: string | The file content decoded as UTF-8 text.  |
| bytes: Buffer   | The raw file content as bytes.           |

### FolderSet

An ordered collection of folders, with glob filtering and lookup by path.

| Declaration                                                                   | Description                                            |
|-------------------------------------------------------------------------------|--------------------------------------------------------|
| match(glob: string \| string[]): [FolderSet](#folderset)                      | Filters the set to folders matching the glob or globs. |
| get(path: string): [Folder](#folder) \| undefined                             | The folder at an absolute path.                    |
| length: number                                                                | The count of folders in the set.                       |
| forEach(visit: (folder: [Folder](#folder), index: number) => void): void      | Runs a function over each folder in order.             |
| map(transform: (folder: [Folder](#folder), index: number) => T): T[]          | Maps each folder to a value.                           |
| filter(keep: (folder: [Folder](#folder)) => boolean): [FolderSet](#folderset) | Returns the folders that satisfy a predicate.          |
| find(match: (folder: [Folder](#folder)) => boolean): [Folder](#folder) \| undefined | Returns the first folder that satisfies a predicate.   |
| paths(): string[]                                                             | The absolute paths in the set, sorted.            |

### Folder

One folder in the project.

| Declaration                      | Description                              |
|----------------------------------|------------------------------------------|
| path: string                     | The absolute path, forward-slashed. |
| name: string                     | The folder base name.                    |
| files: [FileSet](#fileset)       | The files directly inside this folder.   |
| folders: [FolderSet](#folderset) | The folders directly inside this folder. |

### Ast

The syntax tree of a parsed file.

| Declaration                           | Description                                   |
|---------------------------------------|-----------------------------------------------|
| source: [SourceFile](#external-types) | The TypeScript source file.                   |
| nodes: [NodeCursor](#nodecursor)[]    | Every node, flattened in source order.        |
| lineAt(offset: number): number        | The 1-based line a character offset falls on. |

### NodeCursor

One node in a syntax tree with its position.

| Declaration                   | Description                          |
|-------------------------------|--------------------------------------|
| node: [Node](#external-types) | The TypeScript node.                 |
| line: number                  | The 1-based line the node starts on. |

### Program

A type-checked TypeScript program.

| Declaration                             | Description                               |
|-----------------------------------------|-------------------------------------------|
| checker: [TypeChecker](#external-types) | The program type checker.                 |
| files: [FileSet](#fileset)              | The files included in the program.        |
| ast(file: [File](#file)): [Ast](#ast)   | The syntax tree of a file in the program. |

### Line

One line of text with its number.

| Declaration    | Description              |
|----------------|--------------------------|
| number: number | The 1-based line number. |
| text: string   | The line content.        |

### Position

A line and column in a file.

| Declaration    | Description         |
|----------------|---------------------|
| line: number   | The 1-based line.   |
| column: number | The 1-based column. |

### Match

One match of a pattern with its position.

| Declaration      | Description                             |
|------------------|-----------------------------------------|
| text: string     | The matched text.                       |
| index: number    | The character offset of the match.      |
| line: number     | The 1-based line the match starts on.   |
| column: number   | The 1-based column the match starts on. |
| groups: string[] | The captured groups.                    |

### StatusEntry

The git status of one path.

| Declaration        | Description                                       |
|--------------------|---------------------------------------------------|
| path: string       | The repo-relative path.                           |
| staged: boolean    | True when the path holds staged changes.          |
| unstaged: boolean  | True when the path holds unstaged changes.        |
| untracked: boolean | True when git tracks the path for the first time. |

### ShellOptions

The options for a shell command.

| Declaration       | Description                                                    |
|-------------------|----------------------------------------------------------------|
| cwd: string       | The working directory, relative to the project root.           |
| timeoutMs: number | The time a command runs before it is stopped, in milliseconds. |

### ShellResult

The outcome of a shell command.

| Declaration    | Description                              |
|----------------|------------------------------------------|
| ok: boolean    | True when the command exits with code 0. |
| stdout: string | The captured standard output.            |
| stderr: string | The captured standard error.             |
| code: number   | The exit code.                           |

### PackageManifest

A parsed `package.json`.

| Declaration                              | Description                                  |
|------------------------------------------|----------------------------------------------|
| name: string                             | The package name.                            |
| version: string                          | The package version.                         |
| scripts: Record<string, string>          | The scripts, keyed by name.                  |
| dependencies: Record<string, string>     | The runtime dependencies, keyed by name.     |
| devDependencies: Record<string, string>  | The development dependencies, keyed by name. |
| peerDependencies: Record<string, string> | The peer dependencies, keyed by name.        |

### External types

Types provided by other packages.

| Type        | Source                                                                            |
|-------------|-----------------------------------------------------------------------------------|
| Buffer      | [Node.js](https://nodejs.org/api/buffer.html)                                     |
| SourceFile  | [TypeScript](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) |
| Node        | [TypeScript](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) |
| TypeChecker | [TypeScript](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) |
