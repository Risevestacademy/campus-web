import { describe, expect, it } from "vitest";

import {
  parseChooserPage,
  parseCohortEdit,
  parseNewCohort,
} from "./cohort.schema";

describe("parseChooserPage", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["40", 40],
    ["9007199254740991", 9007199254740991],
  ])("reads %j as page %i", (value, page) => {
    expect(parseChooserPage(value)).toBe(page);
  });

  it.each([
    undefined,
    "",
    "0",
    "-1",
    "01",
    "1.5",
    "1e3",
    " 2",
    "2abc",
    "abc",
    "9007199254740992",
  ])("falls back to page 1 for %j", (value) => {
    expect(parseChooserPage(value)).toBe(1);
  });
});

function cohortForm(fields: Record<string, string>) {
  const form = new FormData();
  const filled = {
    name: "Cohort 1",
    code: "c1",
    startDate: "",
    endDate: "",
    status: "upcoming",
    ...fields,
  };
  for (const [field, value] of Object.entries(filled)) form.set(field, value);
  return form;
}

describe("parseNewCohort", () => {
  it("trims the name and code and uppercases the code", () => {
    expect(
      parseNewCohort(cohortForm({ name: "  Cohort 1 ", code: " c1 " })),
    ).toEqual({
      kind: "valid",
      cohort: { name: "Cohort 1", code: "C1", status: "upcoming" },
    });
  });

  it("leaves out dates that were not entered", () => {
    const parsed = parseNewCohort(cohortForm({}));

    expect(parsed.kind === "valid" && Object.keys(parsed.cohort)).toEqual([
      "name",
      "code",
      "status",
    ]);
  });

  it("keeps the dates and status the admin chose", () => {
    expect(
      parseNewCohort(
        cohortForm({
          startDate: "2026-09-01",
          endDate: "2027-06-30",
          status: "active",
        }),
      ),
    ).toEqual({
      kind: "valid",
      cohort: {
        name: "Cohort 1",
        code: "C1",
        startDate: "2026-09-01",
        endDate: "2027-06-30",
        status: "active",
      },
    });
  });

  it("accepts a cohort that starts and ends on the same day", () => {
    expect(
      parseNewCohort(
        cohortForm({ startDate: "2026-09-01", endDate: "2026-09-01" }),
      ).kind,
    ).toBe("valid");
  });

  it("names each blank required field", () => {
    expect(parseNewCohort(cohortForm({ name: "   ", code: "" }))).toEqual({
      kind: "invalid",
      errors: {
        name: "Enter a cohort name.",
        code: "Enter a cohort code.",
      },
    });
  });

  it("rejects an end date before the start date", () => {
    expect(
      parseNewCohort(
        cohortForm({ startDate: "2026-09-02", endDate: "2026-09-01" }),
      ),
    ).toEqual({
      kind: "invalid",
      errors: { endDate: "End date must be on or after the start date." },
    });
  });

  it("rejects a date that is not YYYY-MM-DD", () => {
    expect(parseNewCohort(cohortForm({ startDate: "01/09/2026" }))).toEqual({
      kind: "invalid",
      errors: { startDate: "Enter a valid date." },
    });
  });

  it.each(["", "archived"])("rejects the status %j", (status) => {
    expect(parseNewCohort(cohortForm({ status }))).toEqual({
      kind: "invalid",
      errors: { status: "Choose a status." },
    });
  });
});

const cohort = {
  id: "cohort-1",
  name: "Cohort 1",
  code: "C1",
  startDate: "2026-09-01",
  endDate: "2027-06-30",
  status: "upcoming" as const,
};

describe("parseCohortEdit", () => {
  it("returns only normalized fields that changed", () => {
    expect(
      parseCohortEdit(
        cohortForm({
          name: " Renamed cohort ",
          code: " c2 ",
          startDate: "2026-09-01",
          endDate: "2027-06-30",
          status: "active",
        }),
        cohort,
      ),
    ).toEqual({
      kind: "valid",
      changes: {
        name: "Renamed cohort",
        code: "C2",
        status: "active",
      },
    });
  });

  it("uses null to clear an optional date", () => {
    expect(
      parseCohortEdit(
        cohortForm({
          startDate: "2026-09-01",
          endDate: "",
        }),
        cohort,
      ),
    ).toEqual({
      kind: "valid",
      changes: { endDate: null },
    });
  });

  it("does not produce a mutation when normalized values are unchanged", () => {
    expect(
      parseCohortEdit(
        cohortForm({
          name: " Cohort 1 ",
          code: " c1 ",
          startDate: "2026-09-01",
          endDate: "2027-06-30",
        }),
        cohort,
      ),
    ).toEqual({ kind: "unchanged" });
  });

  it("validates the complete edited date range", () => {
    expect(
      parseCohortEdit(
        cohortForm({
          startDate: "2027-07-01",
          endDate: "2027-06-30",
        }),
        cohort,
      ),
    ).toEqual({
      kind: "invalid",
      errors: { endDate: "End date must be on or after the start date." },
    });
  });
});
