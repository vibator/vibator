/**
 * A terminal spinner that names the running rule.
 *
 * @packageDocumentation
 */
import { Worker } from "node:worker_threads";
import type { ProgressEvent } from "../engine/index.ts";

/** A message that starts the spinner on a label or clears it. */
export type SpinnerMessage =
  | {
      /** Draw the spinner. */
      type: "spin";
      /** The text after the frame. */
      label: string;
    }
  | {
      /** Stop and erase the line. */
      type: "clear";
    };

/** The worker end the listener posts messages to. */
export interface SpinnerPort {
  /**
   * Posts a message to the drawing thread.
   *
   * @param message - The message to post.
   */
  postMessage(message: SpinnerMessage): void;
}

/**
 * The drawing loop. It runs on a worker thread and writes straight to the
 * file descriptor, so the spinner keeps moving while a rule blocks the main
 * thread.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const { writeSync } = require("node:fs");

const FRAMES = ["\\u280b", "\\u2819", "\\u2839", "\\u2838", "\\u283c", "\\u2834", "\\u2826", "\\u2827", "\\u2807", "\\u280f"];
const CLEAR_LINE = "\\r\\u001b[2K";
const INTERVAL = 80;

let frame = 0;
let label = "";
let timer;

function draw() {
  writeSync(workerData.fd, CLEAR_LINE + FRAMES[frame % FRAMES.length] + " " + label);
  frame += 1;
}

parentPort.on("message", (message) => {
  if (message.type === "spin") {
    label = message.label;
    draw();
    if (!timer) timer = setInterval(draw, INTERVAL);
    return;
  }
  if (timer) clearInterval(timer);
  timer = undefined;
  writeSync(workerData.fd, CLEAR_LINE);
});
`;

/**
 * Starts the drawing thread for a file descriptor.
 *
 * @param fd - The file descriptor the thread draws on. Defaults to standard
 * error.
 * @returns The worker.
 */
export function spawnWorker(fd = 2): Worker {
  const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { fd } });
  worker.unref();
  return worker;
}

/**
 * Creates a progress listener that draws a spinner with the running rule on
 * a stream, and draws nothing when the stream is not a terminal.
 *
 * @param stream - The stream to draw on. Defaults to standard error.
 * @param spawn - Starts the drawing thread. Defaults to a worker on
 * standard error.
 * @returns The listener to pass as `onProgress`.
 */
export function spinner(
  stream: NodeJS.WriteStream = process.stderr,
  spawn: () => SpinnerPort = spawnWorker,
): (event: ProgressEvent) => void {
  if (!stream.isTTY) return () => undefined;
  let port: SpinnerPort | undefined;
  return (event) => {
    port ??= spawn();
    if (event.type === "done") {
      port.postMessage({ type: "clear" });
      return;
    }
    const label = `[${event.index + 1}/${event.total}] ${event.ruleId}`;
    port.postMessage({ type: "spin", label });
  };
}
