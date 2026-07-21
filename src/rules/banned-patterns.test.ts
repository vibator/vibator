import { describe, expect, it } from "vitest";
import { createContext } from "../core/context.ts";
import { bannedPatterns } from "./banned-patterns.ts";

/** A context rooted anywhere; this rule never reads from disk. */
const { context } = createContext(process.cwd());

/** The options exercised throughout: one ban on direct axios imports. */
const options = {
  patterns: [
    {
      pattern: 'from "axios"',
      flags: "",
      message: "Imports axios directly",
      expected: "HTTP goes through src/api/client",
      fix: "Import the client from src/api/client instead",
    },
  ],
  ignoreMarkers: ["vibator-ignore"],
};

/**
 * Runs the rule over literal content.
 *
 * @param content - The file's bytes, as text.
 * @returns The diagnostics produced.
 */
function run(content: string) {
  return bannedPatterns.checkFile({
    file: "sample.ts",
    bytes: Buffer.from(content),
    options,
    context,
  });
}

describe("banned-patterns", () => {
  it("flags a matching line with the pattern's own three fields", () => {
    const found = run('import axios from "axios";\n');
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(1);
    expect(found[0]?.message).toBe("Imports axios directly");
    expect(found[0]?.expected).toBe("HTTP goes through src/api/client");
    expect(found[0]?.fix).toContain("src/api/client");
  });

  it("accepts a file with no match", () => {
    expect(run('import { client } from "./api/client";\n')).toEqual([]);
  });

  it("reports every matching line, not just the first", () => {
    const twice = 'import a from "axios";\nimport b from "axios";\n';
    expect(run(twice)).toHaveLength(2);
  });

  it("honours a reasoned ignore marker on the line above", () => {
    const excused =
      '// vibator-ignore: the client itself wraps axios\nimport axios from "axios";\n';
    expect(run(excused)).toEqual([]);
  });

  it("accepts hash-style comments for the marker", () => {
    const found = bannedPatterns.checkFile({
      file: "config.yaml",
      bytes: Buffer.from(
        "# vibator-ignore: templated by the deploy job\npassword: PLACEHOLDER\n",
      ),
      options: {
        ...options,
        patterns: [
          {
            pattern: "^password:",
            flags: "",
            message: "Plain password key",
            expected: "Secrets come from the vault",
            fix: "Reference the vault key instead",
          },
        ],
      },
      context,
    });
    expect(found).toEqual([]);
  });

  it("does not accept the bare marker without a reason", () => {
    const bare = '// vibator-ignore:\nimport axios from "axios";\n';
    expect(run(bare)).toHaveLength(1);
  });

  it("skips binary content", () => {
    expect(run('\0import axios from "axios";\n')).toEqual([]);
  });

  it("applies regular expression flags", () => {
    const found = bannedPatterns.checkFile({
      file: "sample.ts",
      bytes: Buffer.from("// todo: later\n"),
      options: {
        ...options,
        patterns: [
          {
            pattern: "TODO(?!\\(#)",
            flags: "i",
            message: "TODO without a ticket",
            expected: "Every TODO names its ticket, like TODO(#123)",
            fix: "Add the ticket reference or do it now",
          },
        ],
      },
      context,
    });
    expect(found).toHaveLength(1);
  });
});
