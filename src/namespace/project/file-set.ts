/**
 * The `File` value and the `FileSet` collection over the project's files.
 *
 * @packageDocumentation
 */
import { readFileSync } from "node:fs";
import { basename, extname, relative } from "node:path";
import { glob } from "../glob/index.ts";

/**
 * Forward-slashes a path.
 *
 * @param path - The path to normalize.
 * @returns The path with backslashes replaced by forward slashes.
 */
export function slashed(path: string): string {
  return path.replaceAll("\\", "/");
}

/**
 * One file in the project, reading its content and bytes on first access.
 */
export class File {
  /** The absolute path, forward-slashed. */
  readonly path: string;
  /** The file base name. */
  readonly name: string;
  /** The file extension, including the dot. */
  readonly ext: string;
  /** The decoded text, cached after the first read. */
  private cachedContent?: string;
  /** The raw bytes, cached after the first read. */
  private cachedBytes?: Buffer;

  /**
   * Builds a file over an absolute path.
   *
   * @param absolute - The absolute path of the file.
   */
  constructor(private readonly absolute: string) {
    this.path = slashed(absolute);
    this.name = basename(absolute);
    this.ext = extname(absolute);
  }

  /**
   * The file content decoded as UTF-8 text.
   *
   * @returns The decoded text.
   */
  get content(): string {
    this.cachedContent ??= readFileSync(this.absolute, "utf8");
    return this.cachedContent;
  }

  /**
   * The raw file content as bytes.
   *
   * @returns The raw bytes.
   */
  get bytes(): Buffer {
    this.cachedBytes ??= readFileSync(this.absolute);
    return this.cachedBytes;
  }
}

/**
 * An ordered collection of files, with glob filtering and lookup by path.
 */
export class FileSet {
  /** The files in the set, in discovery order. */
  private readonly files: File[];

  /**
   * Builds a FileSet over a list of absolute paths.
   *
   * @param root - The absolute project root, for glob matching.
   * @param paths - The absolute paths in the set.
   */
  constructor(
    private readonly root: string,
    paths: string[],
  ) {
    this.files = paths.map((path) => new File(path));
  }

  /** The count of files in the set. */
  get length(): number {
    return this.files.length;
  }

  /**
   * Filters the set to files matching the glob or globs.
   *
   * @param globs - One glob, or several globs.
   * @returns The files that match.
   */
  match(globs: string | string[]): FileSet {
    return new FileSet(
      this.root,
      this.files
        .filter((file) => glob.matches(relative(this.root, file.path), globs))
        .map((file) => file.path),
    );
  }

  /**
   * Runs a function over each file in order.
   *
   * @param visit - Called with each file and its index.
   */
  forEach(visit: (file: File, index: number) => void): void {
    this.files.forEach(visit);
  }

  /**
   * Maps each file to a value.
   *
   * @param transform - Called with each file and its index.
   * @returns The mapped values.
   */
  map<T>(transform: (file: File, index: number) => T): T[] {
    return this.files.map(transform);
  }

  /**
   * Returns the files that satisfy a predicate.
   *
   * @param keep - Called with each file; returns whether to keep it.
   * @returns The files that satisfy the predicate.
   */
  filter(keep: (file: File) => boolean): FileSet {
    return new FileSet(
      this.root,
      this.files.filter(keep).map((file) => file.path),
    );
  }

  /**
   * Returns the first file that satisfies a predicate.
   *
   * @param match - Called with each file; returns whether it matches.
   * @returns The first matching file, or undefined.
   */
  find(match: (file: File) => boolean): File | undefined {
    return this.files.find(match);
  }

  /**
   * The absolute paths in the set, sorted.
   *
   * @returns The sorted paths.
   */
  paths(): string[] {
    return this.files.map((file) => file.path).sort();
  }

  /**
   * The file at an absolute path, read fresh when absent from the set.
   *
   * @param path - The absolute path.
   * @returns The file at that path.
   */
  get(path: string): File {
    return (
      this.files.find((file) => file.path === slashed(path)) ?? new File(path)
    );
  }
}
