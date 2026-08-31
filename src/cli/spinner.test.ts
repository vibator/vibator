import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type SpinnerMessage, spawnWorker, spinner } from "./spinner.ts";

/**
 * A fake stream that only carries the terminal flag.
 *
 * @param isTTY - Whether the stream reports being a terminal.
 * @returns The fake stream.
 */
function fakeStream(isTTY: boolean): NodeJS.WriteStream {
  return { isTTY } as unknown as NodeJS.WriteStream;
}

/**
 * A fake worker port that records the messages it receives.
 *
 * @returns The port and its recorded messages.
 */
function fakePort(): {
  port: { postMessage(message: SpinnerMessage): void };
  messages: SpinnerMessage[];
} {
  const messages: SpinnerMessage[] = [];
  return {
    port: { postMessage: (message) => messages.push(message) },
    messages,
  };
}

/**
 * Waits the given milliseconds.
 *
 * @param ms - The milliseconds to wait.
 * @returns A promise that resolves after the wait.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("spinner", () => {
  it("does nothing when the stream is not a terminal", () => {
    let spawned = 0;
    const report = spinner(fakeStream(false), () => {
      spawned += 1;
      return fakePort().port;
    });
    report({ type: "start", ruleId: "a", index: 0, total: 1 });
    report({ type: "done", ruleId: "a", index: 0, total: 1, findings: 0 });
    expect(spawned).toBe(0);
  });

  it("posts a spin with the position and rule, then a clear", () => {
    const { port, messages } = fakePort();
    const report = spinner(fakeStream(true), () => port);
    report({ type: "start", ruleId: "biome", index: 1, total: 3 });
    report({ type: "done", ruleId: "biome", index: 1, total: 3, findings: 2 });
    expect(messages).toEqual([
      { type: "spin", label: "[2/3] biome" },
      { type: "clear" },
    ]);
  });

  it("spawns one worker across rules", () => {
    let spawned = 0;
    const { port } = fakePort();
    const report = spinner(fakeStream(true), () => {
      spawned += 1;
      return port;
    });
    report({ type: "start", ruleId: "a", index: 0, total: 2 });
    report({ type: "done", ruleId: "a", index: 0, total: 2, findings: 0 });
    report({ type: "start", ruleId: "b", index: 1, total: 2 });
    expect(spawned).toBe(1);
  });
});

describe("spawnWorker", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "vibator-spinner-"));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("keeps drawing while the main thread is blocked", async () => {
    const path = join(dir, "out");
    const fd = openSync(path, "w");
    const worker = spawnWorker(fd);
    try {
      worker.postMessage({ type: "spin", label: "[1/1] slow" });
      // Block the main thread the way a synchronous rule does.
      const until = Date.now() + 400;
      while (Date.now() < until) {
        // busy wait
      }
      worker.postMessage({ type: "clear" });
      await sleep(100);
      const drawn = readFileSync(path, "utf8");
      const frames = drawn.split("\r").filter((part) => part.length > 0);
      expect(frames.length).toBeGreaterThan(2);
      expect(drawn).toContain("[1/1] slow");
      expect(drawn.endsWith("\r\u001b[2K")).toBe(true);
    } finally {
      await worker.terminate();
      closeSync(fd);
    }
  });
});
