/**
 * Loading the optional `typescript` peer dependency.
 *
 * @remarks Two properties matter here. First, the module is imported
 * dynamically, so a project running only text rules never pays for the
 * compiler and never has to install it. Second, resolution starts from the
 * project being checked, not from wherever this package happens to live:
 * the type-aware rules must judge code with the project's own compiler
 * version, and a one-off runner (an `npx` cache, a globally installed copy)
 * would otherwise resolve the wrong one or none at all.
 *
 * @packageDocumentation
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type ts from "typescript";

/**
 * The TypeScript entry point resolved from the project, when it has one.
 *
 * @param root - Absolute project root.
 * @returns The module's absolute path, or `undefined` when the project does
 * not provide TypeScript.
 */
function projectTypeScriptPath(root: string): string | undefined {
  try {
    const requireFromProject = createRequire(join(root, "package.json"));
    return requireFromProject.resolve("typescript");
  } catch {
    return undefined;
  }
}

/**
 * Loads the TypeScript module, preferring the project's own copy.
 *
 * @param root - Absolute root of the project being checked.
 * @returns The TypeScript module.
 * @throws With an install hint when no copy can be resolved at all.
 */
export async function loadTypeScript(root: string): Promise<typeof ts> {
  const projectCopy = projectTypeScriptPath(root);
  if (projectCopy) {
    const loaded = await import(pathToFileURL(projectCopy).href);
    return (loaded as { default: typeof ts }).default;
  }

  const fallback = await import("typescript").catch(() => {
    throw new Error(
      "This rule needs TypeScript, which is an optional peer dependency.\n" +
        "Install it with: npm install --save-dev typescript",
    );
  });
  return fallback.default;
}
