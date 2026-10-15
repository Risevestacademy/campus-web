import { describe, expect, it } from "vitest";
import * as z from "zod";

import { parseJson } from "./parse-json";

const schema = z.object({ name: z.string() });

describe("parseJson", () => {
  it("returns the parsed value without keys the schema does not declare", () => {
    expect(
      parseJson(schema, JSON.stringify({ name: "Ada", role: "admin" })),
    ).toStrictEqual({ name: "Ada" });
  });

  it("returns undefined for text that is not JSON", () => {
    expect(parseJson(schema, "{name: Ada}")).toBeUndefined();
  });

  it("returns undefined for JSON the schema rejects", () => {
    expect(parseJson(schema, JSON.stringify({ name: 1 }))).toBeUndefined();
  });

  it.each([null, undefined, ""])("returns undefined for %j", (text) => {
    expect(parseJson(schema, text)).toBeUndefined();
  });
});
