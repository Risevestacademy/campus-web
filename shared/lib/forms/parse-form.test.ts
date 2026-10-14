import { describe, expect, it } from "vitest";
import { z } from "zod";

import { optionalIsoDate, optionalText, parseForm } from "./index";

function formOf(fields: Record<string, string | File | string[]>) {
  const form = new FormData();
  for (const [field, value] of Object.entries(fields)) {
    for (const entry of [value].flat()) form.append(field, entry);
  }
  return form;
}

const nameSchema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
});

describe("parseForm", () => {
  it("reads only the fields the schema declares", () => {
    expect(
      parseForm(nameSchema, formOf({ name: " Ada ", role: "admin" })),
    ).toStrictEqual({ kind: "valid", data: { name: "Ada" } });
  });

  it("reports a missing required field as invalid", () => {
    const schema = z.object({ name: z.string("Enter a name.") });

    expect(parseForm(schema, formOf({}))).toStrictEqual({
      kind: "invalid",
      errors: { name: "Enter a name." },
    });
  });

  it("does not coerce a missing field to zero", () => {
    const schema = z.object({ seats: z.coerce.number("Enter a number.") });

    expect(parseForm(schema, formOf({}))).toStrictEqual({
      kind: "invalid",
      errors: { seats: "Enter a number." },
    });
  });

  it("passes every value of a repeated field", () => {
    const schema = z.object({ tags: z.array(z.string()) });

    expect(parseForm(schema, formOf({ tags: ["a", "b"] }))).toStrictEqual({
      kind: "valid",
      data: { tags: ["a", "b"] },
    });
  });

  it("keeps the first message for each field", () => {
    const schema = z.object({
      code: z.string().min(1, "Enter a code.").regex(/^\d+$/, "Use digits."),
    });

    expect(parseForm(schema, formOf({ code: "" }))).toStrictEqual({
      kind: "invalid",
      errors: { code: "Enter a code." },
    });
  });

  it("reports a refinement on the field its path names", () => {
    const schema = z
      .object({ start: z.string(), end: z.string() })
      .refine(({ start, end }) => end >= start, {
        path: ["end"],
        error: "End must not be before start.",
      });

    expect(parseForm(schema, formOf({ start: "b", end: "a" }))).toStrictEqual({
      kind: "invalid",
      errors: { end: "End must not be before start." },
    });
  });

  it("returns an issue that names no field as the form error", () => {
    const schema = z
      .object({ name: z.string() })
      .refine(() => false, { error: "Form-level problem." });

    expect(parseForm(schema, formOf({ name: "Ada" }))).toStrictEqual({
      kind: "invalid",
      errors: {},
      formError: "Form-level problem.",
    });
  });

  it("passes a file through to the schema", () => {
    const screenshot = new File(["png"], "shot.png", { type: "image/png" });
    const schema = z.object({ screenshot: z.file() });

    const read = parseForm(schema, formOf({ screenshot }));

    expect(read.kind === "valid" && read.data.screenshot.name).toBe("shot.png");
  });
});

describe("optionalText", () => {
  const schema = z.object({ note: optionalText() });

  it.each([
    ["an empty field", ""],
    ["a blank field", "   "],
  ])("reads %s as absent", (_, note) => {
    expect(parseForm(schema, formOf({ note }))).toStrictEqual({
      kind: "valid",
      data: { note: undefined },
    });
  });

  it("trims text", () => {
    expect(parseForm(schema, formOf({ note: " hi " }))).toStrictEqual({
      kind: "valid",
      data: { note: "hi" },
    });
  });
});

describe("optionalIsoDate", () => {
  const schema = z.object({ start: optionalIsoDate("Enter a valid date.") });

  it("reads an empty field as absent", () => {
    expect(parseForm(schema, formOf({ start: "" }))).toStrictEqual({
      kind: "valid",
      data: { start: undefined },
    });
  });

  it("keeps an ISO date", () => {
    expect(parseForm(schema, formOf({ start: "2026-09-01" }))).toStrictEqual({
      kind: "valid",
      data: { start: "2026-09-01" },
    });
  });

  it("rejects a non-ISO date with the caller's message", () => {
    expect(parseForm(schema, formOf({ start: "01/09/2026" }))).toStrictEqual({
      kind: "invalid",
      errors: { start: "Enter a valid date." },
    });
  });
});
