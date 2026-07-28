/**
 * The `shell` namespace: gateway to the shell.
 *
 * @packageDocumentation
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { requireRoot } from "../runtime.ts";

/**
 * The options for a shell command.
 */
export interface ShellOptions {
  /** The working directory, relative to the project root. */
  cwd?: string;
  /** The time a command runs before it is stopped, in milliseconds. */
  timeoutMs?: number;
}

/**
 * The outcome of a shell command.
 */
export interface ShellResult {
  /** True when the command exits with code 0. */
  readonly ok: boolean;
  /** The captured standard output. */
  readonly stdout: string;
  /** The captured standard error. */
  readonly stderr: string;
  /** The exit code. */
  readonly code: number;
}

/**
 * Gateway to the shell.
 */
export const shell = {
  /**
   * Runs a command and returns its outcome.
   *
   * @param command - The command to run.
   * @param options - The working directory and timeout.
   * @returns The outcome of the command.
   */
  run(command: string, options: ShellOptions): ShellResult {
    const root = requireRoot();
    const result = spawnSync(command, {
      cwd: options.cwd ? join(root, options.cwd) : root,
      timeout: options.timeoutMs,
      encoding: "utf8",
      shell: true,
    });
    return {
      ok: result.status === 0,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      code: result.status ?? 1,
    };
  },
};
