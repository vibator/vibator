/**
 * The `project` namespace: navigate the files and folders in this project, and
 * write to them.
 *
 * @packageDocumentation
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { discoverFiles } from "../discovery.ts";
import { requireRoot } from "../runtime.ts";
import { FileSet } from "./file-set.ts";
import { Folder, type FolderSet } from "./folder-set.ts";

export { File, FileSet } from "./file-set.ts";
export { Folder, FolderSet } from "./folder-set.ts";

/**
 * The project as data: navigate its files and folders, and write to them.
 */
export const project = {
  /** The absolute path of the project root. */
  get root(): string {
    return requireRoot();
  },

  /** Every file in scope for the current run. */
  get files(): FileSet {
    const root = requireRoot();
    return new FileSet(
      root,
      discoverFiles(root).map((rel) => join(root, rel)),
    );
  },

  /** Every top-level folder in the project. */
  get folders(): FolderSet {
    const root = requireRoot();
    return new Folder(root, root, "", discoverFiles(root)).folders;
  },

  /**
   * Writes content to an absolute path, creating the file when the path is new
   * and overwriting it when the path exists.
   *
   * @param path - The absolute path to write.
   * @param content - The content to write.
   */
  write(path: string, content: string): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  },
};
