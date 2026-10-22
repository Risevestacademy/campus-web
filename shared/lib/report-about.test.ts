import { describe, expect, it } from "vitest";

import { packReportAbout, splitReportAbout } from "./report-about";

describe("packReportAbout and splitReportAbout", () => {
  it.each([
    [
      { reported: "Ana Okafor", where: "Classroom A" },
      "Ana Okafor | Classroom A",
    ],
    [{ reported: "Ana Okafor", where: "" }, "Ana Okafor |"],
    [{ reported: "Ana|Maria", where: "Hall" }, "Ana/Maria | Hall"],
  ])("packs %j as %j", (input, packed) => {
    expect(packReportAbout(input)).toBe(packed);
  });

  it.each([
    [{ reported: "Ana Okafor", where: "Classroom A" }],
    [{ reported: "Ana Okafor", where: "" }],
    [{ reported: "Ana|Maria", where: "Main | hall" }],
    [{ reported: "ana@campus.local", where: "Profile" }],
  ])("splits what it packed back to who and where: %j", (input) => {
    const split = splitReportAbout(packReportAbout(input));

    expect(split.reported).toBe(input.reported.replaceAll("|", "/"));
    expect(split.where).toBe(input.where || undefined);
  });

  it("splits on the first bar only", () => {
    expect(splitReportAbout("Ana | Main | hall")).toEqual({
      reported: "Ana",
      where: "Main | hall",
    });
  });

  it("reads an about without a bar as the name alone", () => {
    expect(splitReportAbout("Ana Okafor")).toEqual({
      reported: "Ana Okafor",
      where: undefined,
    });
  });

  it.each([null, "", "   ", " | "])("finds nothing in %j", (about) => {
    expect(splitReportAbout(about)).toEqual({
      reported: undefined,
      where: undefined,
    });
  });
});
