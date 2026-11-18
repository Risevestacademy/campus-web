import { describe, expect, it, vi } from "vitest";

import { requireCohortId } from "./require-cohort-id";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("404");
  },
}));

describe("requireCohortId", () => {
  it("returns a validated cohort ID", async () => {
    await expect(
      requireCohortId(Promise.resolve({ id: "cohort-1" })),
    ).resolves.toBe("cohort-1");
  });

  it.each(["", "../cohort-1", "cohort/1", null, 7])(
    "responds not-found to %s",
    async (id) => {
      await expect(requireCohortId(Promise.resolve({ id }))).rejects.toThrow(
        "404",
      );
    },
  );
});
