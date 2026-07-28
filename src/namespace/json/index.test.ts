import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { File } from "../project/index.ts";
import { json } from "./index.ts";

const dir = mkdtempSync(join(tmpdir(), "vibator-json-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;

/** Writes content to a temp file and returns the File over it. */
function fileOf(content: string): File {
  const path = join(dir, `x${counter++}.json`);
  writeFileSync(path, content);
  return new File(path);
}

describe("json.parse", () => {
  it("parses an object", () => {
    expect(json.parse(fileOf('{"a":1,"b":"two"}'))).toEqual({ a: 1, b: "two" });
  });

  it("parses an array", () => {
    expect(json.parse(fileOf("[1,2,3]"))).toEqual([1, 2, 3]);
  });

  it("parses a primitive", () => {
    expect(json.parse(fileOf('"hello"'))).toBe("hello");
  });

  it("parses null", () => {
    expect(json.parse(fileOf("null"))).toBeNull();
  });

  it("returns undefined for malformed JSON", () => {
    expect(json.parse(fileOf("not json"))).toBeUndefined();
  });

  it("returns undefined for empty content", () => {
    expect(json.parse(fileOf(""))).toBeUndefined();
  });
});

describe("json.keys", () => {
  it("flattens nested objects into dotted paths", () => {
    expect(json.keys({ a: 1, b: { c: 2, d: { e: 3 } } })).toEqual([
      "a",
      "b.c",
      "b.d.e",
    ]);
  });

  it("returns an empty array for an empty object", () => {
    expect(json.keys({})).toEqual([]);
  });

  it("indexes into arrays", () => {
    expect(json.keys({ a: ["x", "y"] })).toEqual(["a.0", "a.1"]);
  });

  it("returns an empty array for a primitive", () => {
    expect(json.keys(5)).toEqual([]);
  });

  it("returns an empty array for null", () => {
    expect(json.keys(null)).toEqual([]);
  });

  it("skips empty nested objects", () => {
    expect(json.keys({ a: {} })).toEqual([]);
  });
});
