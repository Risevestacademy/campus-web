import { describe, expect, it } from "vitest";

import { changedFields } from "./changed-fields";

const current = { id: "1", name: "Cohort 1", endDate: null, note: "kept" };

describe("changedFields", () => {
  it("returns an empty patch when nothing changed", () => {
    expect(
      changedFields(current, { name: "Cohort 1", endDate: undefined }),
    ).toStrictEqual({});
  });

  it("returns only the fields that changed", () => {
    expect(
      changedFields(current, { name: "Renamed", endDate: "2027-06-30" }),
    ).toStrictEqual({ name: "Renamed", endDate: "2027-06-30" });
  });

  it("clears a field with null when the next value is absent", () => {
    expect(changedFields(current, { note: undefined })).toStrictEqual({
      note: null,
    });
  });
});
