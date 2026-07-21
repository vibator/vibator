/**
 * Documentation checks over functions, methods and their signatures.
 *
 * @packageDocumentation
 */
import type ts from "typescript";
import {
  analysisOptions,
  currentFile,
  type Report,
  syntax,
  type Violation,
} from "./state.ts";

/**
 * The 1-based line a position falls on.
 *
 * @param sourceFile - The file being checked.
 * @param position - A character offset into that file.
 * @returns The line number as reported to the reader.
 */
function lineOf(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

/**
 * Reports whether any comment (line or block) directly precedes the node.
 * @param sourceFile - The node's source file.
 * @param node - The statement-level node to inspect.
 * @returns True when a leading comment is attached.
 */
function hasLeadingComment(sourceFile: ts.SourceFile, node: ts.Node): boolean {
  const ranges = syntax().getLeadingCommentRanges(
    sourceFile.text,
    node.getFullStart(),
  );
  return (ranges?.length ?? 0) > 0;
}

/**
 * Extracts the TSDoc blocks attached to a node.
 * @param node - The declaration to read.
 * @returns The JSDoc nodes, empty when none are attached.
 */
function jsDocsOf(node: ts.Node): ts.JSDoc[] {
  return (node as { jsDoc?: ts.JSDoc[] }).jsDoc ?? [];
}

/**
 * Whether an explicit return-type annotation denotes an observable value.
 * @remarks The annotation is authoritative: `void`, `never`, `Promise<void>`
 * and assertion signatures carry nothing a caller can observe, and a type
 * predicate is exempt from `@returns` by contract.
 * @param type - The annotated return type.
 * @returns True when `@returns` is due on the strength of the annotation.
 */
function annotationReturnsValue(type: ts.TypeNode): boolean {
  if (syntax().isTypePredicateNode(type)) return false;
  return !/^(void|never|Promise<void>|asserts\b.*)$/.test(type.getText());
}

/**
 * Whether a function body contains a `return` carrying a value.
 * @remarks Nested functions are never descended into: their returns belong to
 * them, not to the enclosing signature.
 * @param body - The function body to walk.
 * @returns True when a value-carrying `return` is reached.
 */
function hasValueReturn(body: ts.Block): boolean {
  let foundReturn = false;
  const visit = (node: ts.Node): void => {
    if (foundReturn || syntax().isFunctionLike(node)) return;
    if (syntax().isReturnStatement(node) && node.expression) {
      foundReturn = true;
      return;
    }
    syntax().forEachChild(node, visit);
  };
  syntax().forEachChild(body, visit);
  return foundReturn;
}

/**
 * Decides whether a function-like returns a value a caller can observe, using
 * the annotation when present and otherwise scanning the body.
 * @param functionLike - The function-like to inspect.
 * @returns True when `@returns` is due.
 */
function returnsValue(functionLike: ts.SignatureDeclaration): boolean {
  if (functionLike.type) return annotationReturnsValue(functionLike.type);

  const body = (functionLike as ts.FunctionLikeDeclaration).body;
  if (!body) return false;
  if (!syntax().isBlock(body)) return true; // expression-bodied arrow

  return hasValueReturn(body);
}

/**
 * The documented `@param` names attached to a declaration.
 * @param docs - The TSDoc blocks to read.
 * @returns The names in source order, so each parameter can claim at most one
 * tag.
 */
function paramTagNames(docs: ts.JSDoc[]): string[] {
  return docs
    .flatMap((doc) => doc.tags ?? [])
    .filter(syntax().isJSDocParameterTag)
    .map((tag) => tag.name.getText());
}

/**
 * Claims one `@param` tag on behalf of a parameter, by name for a plain
 * identifier or the next unclaimed tag for a destructured one, which has no
 * name to match on.
 * @param param - The parameter seeking a tag.
 * @param tags - The documented `@param` names, in source order.
 * @param claimed - Indices already claimed; mutated when a tag is taken.
 * @returns True when a tag was claimed, false when the parameter is undocumented.
 */
function claimParamTag(
  param: ts.ParameterDeclaration,
  tags: string[],
  claimed: Set<number>,
): boolean {
  const wanted = syntax().isIdentifier(param.name)
    ? param.name.getText()
    : undefined;
  const index = tags.findIndex(
    (tag, tagIndex) =>
      !claimed.has(tagIndex) && (wanted === undefined || tag === wanted),
  );
  if (index === -1) return false;

  claimed.add(index);
  return true;
}

/**
 * The report text naming an undocumented parameter.
 * @param param - The parameter with no `@param` tag.
 * @returns The problem text, naming the parameter unless it is destructured and
 * so has no name.
 */
function describeMissingParam(param: ts.ParameterDeclaration): string {
  if (!syntax().isIdentifier(param.name)) {
    return "missing @param for the destructured parameter";
  }
  return `missing @param for "${param.name.text}"`;
}

/**
 * Reports every parameter that fails to claim a `@param` tag; the `this`
 * pseudo-parameter is exempt.
 * @param functionLike - The function-like whose parameters are checked.
 * @param docs - The TSDoc blocks attached to it.
 * @param report - Sink for the violations found.
 */
function checkParamTags(
  functionLike: ts.SignatureDeclaration,
  docs: ts.JSDoc[],
  report: Report,
): void {
  const tags = paramTagNames(docs);
  const claimed = new Set<number>();

  for (const param of functionLike.parameters) {
    if (syntax().isIdentifier(param.name) && param.name.text === "this")
      continue;
    if (claimParamTag(param, tags, claimed)) continue;

    report(describeMissingParam(param));
  }
}

/**
 * Reports a missing `@returns` when the function-like returns an observable
 * value.
 * @remarks `@return` is accepted alongside `@returns`; both spellings are in
 * the wild.
 * @param functionLike - The function-like being checked.
 * @param docs - The TSDoc blocks attached to it.
 * @param report - Sink for the violation, when one is found.
 */
function checkReturnsTag(
  functionLike: ts.SignatureDeclaration,
  docs: ts.JSDoc[],
  report: Report,
): void {
  const hasReturns = docs
    .flatMap((doc) => doc.tags ?? [])
    .some(
      (tag) => tag.tagName.text === "returns" || tag.tagName.text === "return",
    );
  if (returnsValue(functionLike) && !hasReturns) report("missing @returns");
}

/**
 * Reports an undocumented symbol, distinguishing a `//` comment standing in for
 * a doc from no comment at all.
 * @remarks Every symbol carries a TSDoc block. A module-local one is read more
 * often than an exported one, so it earns a stated contract, not a passing
 * `//` note.
 * @param sourceFile - The file the symbol is declared in.
 * @param docHolder - The node a doc comment would attach to.
 * @param report - Sink for the violation.
 */
function reportMissingDoc(
  sourceFile: ts.SourceFile,
  docHolder: ts.Node,
  report: Report,
): void {
  if (hasLeadingComment(sourceFile, docHolder)) {
    report("replace the `//` comment with a TSDoc block");
    return;
  }
  report("needs a TSDoc block");
}

/**
 * Checks one function-like declaration against the documentation bar and
 * appends any violations found.
 * @param sourceFile - The source file being checked.
 * @param functionLike - The function-like node (declaration, method, accessor,
 *   or the initializer of a `const` binding).
 * @param docHolder - The statement the doc comment attaches to (differs from
 *   `functionLike` for `const fn = …` bindings).
 * @param name - The symbol name used in reports.
 * @param violations - The violation sink.
 */
function checkFunction(
  sourceFile: ts.SourceFile,
  functionLike: ts.SignatureDeclaration,
  docHolder: ts.Node,
  name: string,
  violations: Violation[],
): void {
  const file = currentFile();
  const line = lineOf(sourceFile, docHolder.getStart());
  const report: Report = (problem) =>
    violations.push({ file, line, symbol: name, problem });

  const docs = jsDocsOf(docHolder);
  if (docs.length === 0) {
    reportMissingDoc(sourceFile, docHolder, report);
    return;
  }
  if (analysisOptions().requireParams) {
    checkParamTags(functionLike, docs, report);
  }
  if (analysisOptions().requireReturns) {
    checkReturnsTag(functionLike, docs, report);
  }
}

/**
 * Checks the function-like bindings of a variable statement.
 * @remarks Only `const fn = () => {}` style bindings qualify, and the doc
 * comment attaches to the statement, not to the initializer.
 * @param sourceFile - The file the statement belongs to.
 * @param statement - The variable statement to inspect.
 * @param violations - The violation sink.
 */
function checkVariableStatement(
  sourceFile: ts.SourceFile,
  statement: ts.VariableStatement,
  violations: Violation[],
): void {
  for (const declaration of statement.declarationList.declarations) {
    const initializer = declaration.initializer;
    if (!initializer || !syntax().isIdentifier(declaration.name)) continue;
    if (
      !syntax().isArrowFunction(initializer) &&
      !syntax().isFunctionExpression(initializer)
    )
      continue;

    checkFunction(
      sourceFile,
      initializer,
      statement,
      declaration.name.text,
      violations,
    );
  }
}

/** The class members that carry a documentable signature. */
type ClassMember =
  | ts.MethodDeclaration
  | ts.ConstructorDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

/**
 * Type guard for {@link ClassMember}.
 * @remarks Properties and index signatures are not function-likes and fall
 * outside the bar.
 * @param member - The class element to test.
 */
function isClassMember(member: ts.ClassElement): member is ClassMember {
  return (
    syntax().isMethodDeclaration(member) ||
    syntax().isConstructorDeclaration(member) ||
    syntax().isGetAccessorDeclaration(member) ||
    syntax().isSetAccessorDeclaration(member)
  );
}

/**
 * The name a class member reports under.
 * @param member - The member being reported.
 * @returns Its written name; `"constructor"` for a constructor, and
 * `"(computed)"` for a computed name, which can't be resolved without a type
 * checker.
 */
function memberName(member: ClassMember): string {
  if (syntax().isConstructorDeclaration(member)) return "constructor";
  return member.name?.getText() ?? "(computed)";
}

/**
 * Checks every documentable member of a class declaration.
 * @remarks Members are reported under their class-qualified name so the
 * location is unambiguous across a file with several classes.
 * @param sourceFile - The file the class is declared in.
 * @param classDeclaration - The class whose members are checked.
 * @param violations - The violation sink.
 */
function checkClassMembers(
  sourceFile: ts.SourceFile,
  classDeclaration: ts.ClassDeclaration,
  violations: Violation[],
): void {
  const className = classDeclaration.name?.text ?? "(anonymous class)";
  for (const member of classDeclaration.members) {
    if (!isClassMember(member)) continue;

    checkFunction(
      sourceFile,
      member,
      member,
      `${className}.${memberName(member)}`,
      violations,
    );
  }
}

export {
  checkClassMembers,
  checkFunction,
  checkVariableStatement,
  hasLeadingComment,
  jsDocsOf,
  lineOf,
};
