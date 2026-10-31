// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  readInviteCsv,
  templateHref,
} from "./invite-csv";

function read(text: string, overrides: { name?: string; size?: number } = {}) {
  return readInviteCsv({
    name: "cohort.csv",
    size: text.length,
    text,
    ...overrides,
  });
}

describe("reading an invite file", () => {
  it("counts the rows under the header", () => {
    expect(
      read("email,role,track\na@c.io,student,BE\nb@c.io,professor,\n"),
    ).toEqual({ kind: "ready", rows: 2 });
  });

  it("takes columns in any order and any case, with a byte order mark and CRLF", () => {
    expect(read("﻿Role,Email\r\nstudent,a@c.io\r\n")).toEqual({
      kind: "ready",
      rows: 1,
    });
  });

  it("ignores blank lines", () => {
    expect(read("email,role\n\na@c.io,mentor\n\n")).toEqual({
      kind: "ready",
      rows: 1,
    });
  });

  it("refuses what campus-api would refuse as a whole", () => {
    expect(read("a@c.io,student\n")).toMatchObject({
      kind: "invalid",
      message: expect.stringContaining("Missing: email, role"),
    });
    expect(read("email\na@c.io\n")).toMatchObject({
      kind: "invalid",
      message: expect.stringContaining("Missing: role"),
    });
    expect(read("")).toMatchObject({ message: "The file is empty." });
    expect(read("email,role\n")).toMatchObject({
      message: "The file has no rows under its header.",
    });
  });

  it("refuses a file that is not .csv, or too large, or has too many rows", () => {
    expect(read("email,role\na@c.io,student", { name: "x.txt" })).toMatchObject(
      {
        message: "Choose a .csv file.",
      },
    );
    expect(
      read("email,role\na@c.io,student", { size: CSV_MAX_BYTES + 1 }),
    ).toMatchObject({ message: expect.stringContaining("256 KB") });

    const rows = Array.from(
      { length: CSV_MAX_ROWS + 1 },
      (_, index) => `a${index}@c.io,student`,
    );
    expect(read(`email,role\n${rows.join("\n")}`)).toMatchObject({
      message: expect.stringContaining(`at most ${CSV_MAX_ROWS}`),
    });
  });
});

describe("the template", () => {
  function contents(href: string) {
    return decodeURIComponent(href.replace("data:text/csv;charset=utf-8,", ""));
  }

  it("names the columns campus-api reads, with the cohort's own track code", () => {
    expect(contents(templateHref("BE"))).toBe(
      "email,role,track\nada@example.com,student,BE\ngrace@example.com,professor,\n",
    );
  });

  it("is itself a file the page would accept", () => {
    expect(
      readInviteCsv({
        name: "invite-template.csv",
        size: 100,
        text: contents(templateHref(undefined)),
      }),
    ).toEqual({ kind: "ready", rows: 2 });
  });
});
