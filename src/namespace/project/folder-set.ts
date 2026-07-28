/**
 * The `Folder` value and the `FolderSet` collection over the project's folders.
 *
 * @packageDocumentation
 */
import { join, relative } from "node:path";
import { glob } from "../glob/index.ts";
import { FileSet, slashed } from "./file-set.ts";

/**
 * One folder in the project, resolving its files and subfolders on access.
 */
export class Folder {
  /** The absolute path, forward-slashed. */
  readonly path: string;
  /** The absolute paths of the files directly inside this folder. */
  private readonly directFiles: string[] = [];
  /** Each child segment mapped to the paths beneath it, folder-relative. */
  private readonly subfolders = new Map<string, string[]>();

  /**
   * Builds a folder from the repo-relative paths beneath it.
   *
   * @param root - The absolute project root, for glob matching.
   * @param absolute - The absolute path of the folder.
   * @param name - The folder base name.
   * @param relsBeneath - The paths beneath the folder, relative to it.
   */
  constructor(
    private readonly root: string,
    private readonly absolute: string,
    readonly name: string,
    relsBeneath: string[],
  ) {
    this.path = slashed(absolute);
    for (const rel of relsBeneath) {
      const slash = rel.indexOf("/");
      if (slash === -1) {
        this.directFiles.push(join(absolute, rel));
      } else {
        const segment = rel.slice(0, slash);
        const beneath = this.subfolders.get(segment) ?? [];
        beneath.push(rel.slice(slash + 1));
        this.subfolders.set(segment, beneath);
      }
    }
  }

  /**
   * The files directly inside this folder.
   *
   * @returns The direct files.
   */
  get files(): FileSet {
    return new FileSet(this.root, this.directFiles);
  }

  /**
   * The folders directly inside this folder.
   *
   * @returns The child folders.
   */
  get folders(): FolderSet {
    const list = [...this.subfolders.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([segment, beneath]) =>
          new Folder(this.root, join(this.absolute, segment), segment, beneath),
      );
    return new FolderSet(this.root, list);
  }
}

/**
 * An ordered collection of folders, with glob filtering and lookup by path.
 */
export class FolderSet {
  /**
   * Builds a FolderSet over a list of folders.
   *
   * @param root - The absolute project root, for glob matching.
   * @param folders - The folders in the set.
   */
  constructor(
    private readonly root: string,
    private readonly folders: Folder[],
  ) {}

  /** The count of folders in the set. */
  get length(): number {
    return this.folders.length;
  }

  /**
   * Filters the set to folders matching the glob or globs.
   *
   * @param globs - One glob, or several globs.
   * @returns The folders that match.
   */
  match(globs: string | string[]): FolderSet {
    return new FolderSet(
      this.root,
      this.folders.filter((folder) =>
        glob.matches(relative(this.root, folder.path), globs),
      ),
    );
  }

  /**
   * Runs a function over each folder in order.
   *
   * @param visit - Called with each folder and its index.
   */
  forEach(visit: (folder: Folder, index: number) => void): void {
    this.folders.forEach(visit);
  }

  /**
   * Maps each folder to a value.
   *
   * @param transform - Called with each folder and its index.
   * @returns The mapped values.
   */
  map<T>(transform: (folder: Folder, index: number) => T): T[] {
    return this.folders.map(transform);
  }

  /**
   * Returns the folders that satisfy a predicate.
   *
   * @param keep - Called with each folder; returns whether to keep it.
   * @returns The folders that satisfy the predicate.
   */
  filter(keep: (folder: Folder) => boolean): FolderSet {
    return new FolderSet(this.root, this.folders.filter(keep));
  }

  /**
   * Returns the first folder that satisfies a predicate.
   *
   * @param match - Called with each folder; returns whether it matches.
   * @returns The first matching folder, or undefined.
   */
  find(match: (folder: Folder) => boolean): Folder | undefined {
    return this.folders.find(match);
  }

  /**
   * The absolute paths in the set, sorted.
   *
   * @returns The sorted paths.
   */
  paths(): string[] {
    return this.folders.map((folder) => folder.path).sort();
  }

  /**
   * The folder at an absolute path.
   *
   * @param path - The absolute path.
   * @returns The folder at that path, or undefined.
   */
  get(path: string): Folder | undefined {
    return this.folders.find((folder) => folder.path === slashed(path));
  }
}
