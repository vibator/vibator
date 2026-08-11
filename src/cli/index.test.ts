import { describe, expect, it, vi } from "vitest";
import { defineRule, resetRules } from "../rules/define-rule.ts";
import { main } from "./index.ts";

/** Captures what a stream write receives while `run` executes. */
async function capture(
  stream: NodeJS.WriteStream,
  run: () => Promise<number>,
): Promise<{ output: string; code: number }> {
  const chunks: string[] = [];
  const spy = vi.spyOn(stream, "write").mockImplementation(((
    chunk: unknown,
  ) => {
    chunks.push(String(chunk));
    return true;
  }) as never);
  try {
    const code = await run();
    return { output: chunks.join(""), code };
  } finally {
    spy.mockRestore();
  }
}

describe("main", () => {
  it("prints usage for --help", async () => {
    const { output, code } = await capture(process.stdout, () =>
      main(["--help"]),
    );
    expect(code).toBe(0);
    expect(output).toMatch(/usage/i);
  });

  it("prints the version for --version", async () => {
    const { output, code } = await capture(process.stdout, () =>
      main(["--version"]),
    );
    expect(code).toBe(0);
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  it("returns 1 for an unknown command", async () => {
    const { code } = await capture(process.stderr, () => main(["bogus"]));
    expect(code).toBe(1);
  });

  it("runs the default command, rendering findings and returning the exit code", async () => {
    resetRules();
    defineRule({
      id: "boomer",
      title: "Boomer",
      docs: "./b.md",
      check: () => ({ diagnostics: [{ message: "kapow" }] }),
    });
    const { output, code } = await capture(process.stdout, () => main([]));
    expect(code).toBe(1);
    expect(output).toContain("boomer");
    expect(output).toContain("kapow");
  });
});
