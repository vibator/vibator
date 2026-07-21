/**
 * Resources shared by every rule in a run.
 *
 * @packageDocumentation
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadTypeScript } from "./typescript-loader.ts";

/**
 * A TypeScript program, kept structurally typed so the package does not force a
 * `typescript` import on projects whose rules never need one.
 */
interface TypeScriptProgram {
  /** Every file the program resolved, including declarations and libraries. */
  getSourceFiles(): readonly TypeScriptSourceFile[];
  /** The checker used to resolve symbols and signatures. */
  getTypeChecker(): unknown;
}

/** The subset of a TypeScript source file the engine itself touches. */
interface TypeScriptSourceFile {
  /** Absolute path of the file. */
  fileName: string;
}

/**
 * Shared, memoized resources handed to every rule.
 *
 * @remarks Memoization is the point. Six of this package's rules resolve
 * TypeScript symbols, and building a program per rule made the same type-check
 * run six times. One program per tsconfig, reused, turns that back into one.
 */
export interface RuleContext {
  /** Absolute path of the project root every relative path resolves against. */
  root: string;
  /**
   * Reads a file as text, memoized for the run.
   *
   * @param file - A path relative to {@link RuleContext.root}.
   * @returns The file's contents.
   */
  read(file: string): string;
  /**
   * Reads a file as bytes, memoized for the run.
   *
   * @param file - A path relative to {@link RuleContext.root}.
   * @returns The file's contents.
   */
  readBytes(file: string): Buffer;
  /**
   * Builds a type-checked program, memoized per tsconfig for the run.
   *
   * @param tsconfigPath - A tsconfig path relative to the root.
   * @returns The program, shared with every other rule asking for the same one.
   */
  program(tsconfigPath: string): Promise<TypeScriptProgram>;
  /**
   * Memoizes a per-file derivation for the run.
   *
   * @remarks The namespace keeps two callers deriving different things from the
   * same file apart. Kept generic so this module stays free of any TypeScript
   * import: the syntax trees that motivated it are built by the rules, and only
   * cached here.
   * @param namespace - Names the derivation, not the file.
   * @param file - A path relative to {@link RuleContext.root}.
   * @param compute - Produces the value on a miss.
   * @returns The value, computed once per namespace and file.
   */
  memo<Value>(namespace: string, file: string, compute: () => Value): Value;
  /**
   * Runs a git command from the project root.
   *
   * @param args - Arguments passed to `git`.
   * @returns Trimmed stdout.
   */
  git(args: string[]): string;
  /**
   * Reports how far through its work a rule is.
   *
   * @param done - Units completed.
   * @param total - Units in total.
   */
  progress(done: number, total: number): void;
}

/** How the engine tells a context where to send progress. */
export type ProgressSink = (done: number, total: number) => void;

/**
 * Builds the context for one run.
 *
 * @param root - Absolute path of the project root.
 * @returns The context, plus a setter the engine uses to route progress to
 * whichever rule is currently running.
 */
export function createContext(root: string): {
  context: RuleContext;
  setProgressSink: (sink: ProgressSink) => void;
} {
  let sink: ProgressSink = () => {};
  const { readBytes, readText, program, memo } = createReaders(root);

  const context: RuleContext = {
    root,
    readBytes,
    read: readText,
    program,
    memo,
    git: (args) => runGit(root, args),
    progress: (done, total) => {
      sink(done, total);
    },
  };

  return {
    context,
    setProgressSink(next) {
      sink = next;
    },
  };
}

/**
 * Builds the memoized readers a context exposes.
 *
 * @param root - Absolute project root.
 * @returns The byte, text and program readers, each caching for the run.
 */
function createReaders(root: string) {
  const textCache = new Map<string, string>();
  const byteCache = new Map<string, Buffer>();

  const readBytes = (file: string): Buffer => {
    const cached = byteCache.get(file);
    if (cached) return cached;
    const bytes = readFileSync(resolve(root, file));
    byteCache.set(file, bytes);
    return bytes;
  };

  const readText = (file: string): string => {
    const cached = textCache.get(file);
    if (cached !== undefined) return cached;
    const text = readBytes(file).toString("utf8");
    textCache.set(file, text);
    return text;
  };

  return {
    readBytes,
    readText,
    program: createProgramCache(root),
    memo: createMemo(),
  };
}

/**
 * Builds the per-tsconfig program cache.
 *
 * @param root - Absolute project root.
 * @returns A getter sharing one type-checked program per tsconfig.
 */
function createProgramCache(root: string) {
  const programCache = new Map<string, Promise<TypeScriptProgram>>();
  return (tsconfigPath: string): Promise<TypeScriptProgram> => {
    const cached = programCache.get(tsconfigPath);
    if (cached) return cached;
    const built = buildProgram(root, tsconfigPath);
    programCache.set(tsconfigPath, built);
    return built;
  };
}

/**
 * Builds the generic per-file memo.
 *
 * @returns A memoizer computing each namespace-and-file pair once per run.
 */
function createMemo() {
  const memoCache = new Map<string, unknown>();
  return <Value>(
    namespace: string,
    file: string,
    compute: () => Value,
  ): Value => {
    const key = `${namespace}\0${file}`;
    if (memoCache.has(key)) return memoCache.get(key) as Value;
    const value = compute();
    memoCache.set(key, value);
    return value;
  };
}

/**
 * Runs a git command from the project root.
 *
 * @param root - Absolute project root.
 * @param args - Arguments passed to `git`.
 * @returns Trimmed stdout.
 */
function runGit(root: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  }).trim();
}

/**
 * Loads TypeScript on demand and builds a program from a tsconfig.
 *
 * @remarks Imported dynamically so `typescript` stays an optional peer: a
 * project using only the file-based rules never pays for it, and never has to
 * install it.
 * @param root - Absolute project root.
 * @param tsconfigPath - Path to the tsconfig, relative to the root.
 * @returns The type-checked program.
 */
async function buildProgram(
  root: string,
  tsconfigPath: string,
): Promise<TypeScriptProgram> {
  const compiler = await loadTypeScript(root);

  const absolute = resolve(root, tsconfigPath);
  const configFile = compiler.readConfigFile(absolute, compiler.sys.readFile);
  if (configFile.error) {
    throw new Error(
      `Cannot read ${tsconfigPath}.\n` +
        "Rules that resolve types need one. Either point them at the right file\n" +
        '  "no-deprecated-apis": { "options": { "projects": ["path/to/tsconfig.json"] } }\n' +
        "or switch them off:\n" +
        '  "no-deprecated-apis": "off"',
    );
  }

  const parsed = compiler.parseJsonConfigFileContent(
    configFile.config,
    compiler.sys,
    dirname(absolute),
  );
  return compiler.createProgram(
    parsed.fileNames,
    parsed.options,
  ) as unknown as TypeScriptProgram;
}
