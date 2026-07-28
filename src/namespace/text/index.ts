/**
 * The `text` namespace: parse and manipulate files as plain text.
 *
 * @packageDocumentation
 */
import type { File } from "../project/index.ts";

/**
 * One line of text with its number.
 */
export interface Line {
  /** The 1-based line number. */
  readonly number: number;
  /** The line content. */
  readonly text: string;
}

/**
 * A line and column in a file.
 */
export interface Position {
  /** The 1-based line. */
  readonly line: number;
  /** The 1-based column. */
  readonly column: number;
}

/**
 * One match of a pattern with its position.
 */
export interface Match {
  /** The matched text. */
  readonly text: string;
  /** The character offset of the match. */
  readonly index: number;
  /** The 1-based line the match starts on. */
  readonly line: number;
  /** The 1-based column the match starts on. */
  readonly column: number;
  /** The captured groups. */
  readonly groups: string[];
}

/**
 * Resolves a character offset to a 1-based line and column.
 *
 * @param content - The text the offset points into.
 * @param offset - The character offset.
 * @returns The 1-based line and column.
 */
function resolvePosition(content: string, offset: number): Position {
  const clamped = Math.max(0, Math.min(offset, content.length));
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < clamped; index += 1) {
    if (content[index] === "\n") {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: clamped - lineStart + 1 };
}

/**
 * Replaces every non-newline character with a space, keeping line positions.
 *
 * @param region - The text region to blank.
 * @returns The region with non-newline characters replaced by spaces.
 */
function mask(region: string): string {
  return region.replace(/[^\n]/g, " ");
}

/**
 * Parse and manipulate files as plain text.
 */
export const text = {
  /**
   * Splits a file into numbered lines.
   *
   * @param file - The file to split.
   * @returns The numbered lines.
   */
  lines(file: File): Line[] {
    if (file.content === "") return [];
    const split = file.content.split("\n");
    if (split.length > 1 && split[split.length - 1] === "") split.pop();
    return split.map((line, index) => ({ number: index + 1, text: line }));
  },

  /**
   * Returns the file content with JavaScript and TypeScript comments blanked,
   * keeping line positions.
   *
   * @param file - The file to mask.
   * @returns The content with comments blanked.
   */
  maskComments(file: File): string {
    return file.content
      .replace(/\/\*(?:[^*]|\*(?!\/))*\*\//g, mask)
      .replace(/\/\/[^\n]*/g, mask);
  },

  /**
   * Returns the file content with Markdown code fences and spans blanked,
   * keeping line positions.
   *
   * @param file - The file to mask.
   * @returns The content with code regions blanked.
   */
  maskCode(file: File): string {
    return file.content
      .replace(/```[\s\S]*?```/g, mask)
      .replace(/`[^`\n]*`/g, mask);
  },

  /**
   * Resolves a character offset to a line and column.
   *
   * @param file - The file the offset points into.
   * @param offset - The character offset.
   * @returns The line and column.
   */
  positionAt(file: File, offset: number): Position {
    return resolvePosition(file.content, offset);
  },

  /**
   * Returns every match of a pattern with its position.
   *
   * @param file - The file to search.
   * @param pattern - The pattern to match.
   * @returns Every match with its position.
   */
  matches(file: File, pattern: RegExp): Match[] {
    const global = pattern.global
      ? pattern
      : new RegExp(pattern.source, `${pattern.flags}g`);
    const found: Match[] = [];
    for (const match of file.content.matchAll(global)) {
      const index = match.index ?? 0;
      const position = resolvePosition(file.content, index);
      found.push({
        text: match[0],
        index,
        line: position.line,
        column: position.column,
        groups: match.slice(1) as string[],
      });
    }
    return found;
  },

  /**
   * Reports whether the file content is binary.
   *
   * @param file - The file to inspect.
   * @returns Whether the content is binary.
   */
  binary(file: File): boolean {
    return file.bytes.includes(0);
  },
};
