import { describe, expect, it } from "vitest";
import { parseArguments } from "./arguments.ts";

describe("parseArguments", () => {
  it("defaults to the check command", () => {
    const parsed = parseArguments([]);
    expect(parsed.command).toBe("check");
    expect(parsed.reporter).toBe("pretty");
  });

  it("reads flags wherever they appear", () => {
    const parsed = parseArguments([
      "--only",
      "max-file-size,no-conflict-markers",
      "--reporter",
      "json",
    ]);
    expect(parsed.only).toEqual(["max-file-size", "no-conflict-markers"]);
    expect(parsed.reporter).toBe("json");
  });

  it("does not mistake a flag value for a command", () => {
    // `--config list` names a file called "list", not the list command.
    const parsed = parseArguments(["--config", "list"]);
    expect(parsed.command).toBe("check");
    expect(parsed.config).toBe("list");
  });

  it("carries the target of explain", () => {
    const parsed = parseArguments(["explain", "max-file-size"]);
    expect(parsed.command).toBe("explain");
    expect(parsed.target).toBe("max-file-size");
  });

  it("rejects an unknown command rather than silently checking", () => {
    expect(() => parseArguments(["chekc"])).toThrow(/Unknown command/);
  });

  it("rejects an unknown flag", () => {
    expect(() => parseArguments(["--reproter", "json"])).toThrow();
  });

  it("rejects an unknown reporter", () => {
    expect(() => parseArguments(["--reporter", "xml"])).toThrow(
      /Unknown reporter/,
    );
  });

  it("parses the change-scoped flags", () => {
    const parsed = parseArguments(["--changed", "--since", "origin/main"]);
    expect(parsed.changed).toBe(true);
    expect(parsed.since).toBe("origin/main");
    expect(parsed.staged).toBe(false);
    expect(parseArguments(["--staged"]).staged).toBe(true);
  });

  it("recognises help and version", () => {
    expect(parseArguments(["-h"]).help).toBe(true);
    expect(parseArguments(["--version"]).version).toBe(true);
  });
});
