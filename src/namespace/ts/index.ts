/**
 * The `ts` namespace: parse and manipulate TypeScript files.
 *
 * @packageDocumentation
 */
import { dirname } from "node:path";
import type { Node, SourceFile, TypeChecker } from "typescript";
import { type File, FileSet } from "../project/index.ts";
import { requireRoot } from "../runtime.ts";
import { loadTypeScript } from "../typescript.ts";

/**
 * One node in a syntax tree with its position.
 */
export interface NodeCursor {
  /** The TypeScript node. */
  readonly node: Node;
  /** The 1-based line the node starts on. */
  readonly line: number;
}

/**
 * The syntax tree of a parsed file.
 */
export interface Ast {
  /** The TypeScript source file. */
  readonly source: SourceFile;
  /** Every node, flattened in source order. */
  readonly nodes: NodeCursor[];
  /**
   * The 1-based line a character offset falls on.
   *
   * @param offset - A character offset into the file.
   * @returns The 1-based line.
   */
  lineAt(offset: number): number;
}

/**
 * A type-checked TypeScript program.
 */
export interface Program {
  /** The program type checker. */
  readonly checker: TypeChecker;
  /** The files included in the program. */
  readonly files: FileSet;
  /**
   * The syntax tree of a file in the program.
   *
   * @param file - A file included in the program.
   * @returns The file's syntax tree.
   */
  ast(file: File): Ast;
}

/**
 * The script kind a file extension implies.
 *
 * @param typescript - The TypeScript module.
 * @param ext - The file extension, including the dot.
 * @returns The script kind for that extension.
 */
function scriptKindFor(
  typescript: typeof import("typescript"),
  ext: string,
): number {
  if (ext === ".tsx") return typescript.ScriptKind.TSX;
  if (ext === ".jsx") return typescript.ScriptKind.JSX;
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    return typescript.ScriptKind.JS;
  }
  return typescript.ScriptKind.TS;
}

/**
 * Builds an Ast from a source file.
 *
 * @param typescript - The TypeScript module.
 * @param source - The source file to walk.
 * @returns The syntax tree.
 */
function astFromSource(
  typescript: typeof import("typescript"),
  source: SourceFile,
): Ast {
  const nodes: NodeCursor[] = [];
  const visit = (node: Node): void => {
    nodes.push({
      node,
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    });
    typescript.forEachChild(node, visit);
  };
  typescript.forEachChild(source, visit);
  return {
    source,
    nodes,
    lineAt: (offset: number): number =>
      source.getLineAndCharacterOfPosition(offset).line + 1,
  };
}

/**
 * Parse and manipulate TypeScript files.
 */
export const ts = {
  /**
   * Parses a TypeScript or JavaScript file into a syntax tree.
   *
   * @param file - The file to parse.
   * @returns The file's syntax tree.
   */
  parse(file: File): Ast {
    const typescript = loadTypeScript();
    const source = typescript.createSourceFile(
      file.name,
      file.content,
      typescript.ScriptTarget.Latest,
      true,
      scriptKindFor(typescript, file.ext),
    );
    return astFromSource(typescript, source);
  },

  /**
   * Builds a type-checked program from a `tsconfig` file.
   *
   * @param tsconfig - The `tsconfig` file the program resolves against.
   * @returns The type-checked program.
   */
  program(tsconfig: File): Program {
    const typescript = loadTypeScript();
    const config = typescript.readConfigFile(
      tsconfig.path,
      typescript.sys.readFile,
    );
    const parsed = typescript.parseJsonConfigFileContent(
      config.config,
      typescript.sys,
      dirname(tsconfig.path),
    );
    const program = typescript.createProgram(parsed.fileNames, parsed.options);
    const projectFiles = parsed.fileNames.filter(
      (name) => !name.endsWith(".d.ts"),
    );
    return {
      checker: program.getTypeChecker(),
      files: new FileSet(requireRoot(), projectFiles),
      ast(file: File): Ast {
        const source = program.getSourceFile(file.path);
        if (!source) {
          throw new Error(`file not in program: ${file.path}`);
        }
        return astFromSource(typescript, source);
      },
    };
  },
};
