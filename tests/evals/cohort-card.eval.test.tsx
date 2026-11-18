import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CohortCard } from "@/features/campus";

const blankCodes: Array<[string, string | undefined]> = [
  ["an empty code", ""],
  ["no code", undefined],
];

describe("Cohort card eval (required threshold: 3/3)", () => {
  it.each(blankCodes)("renders no code line for %s", (_, code) => {
    render(<CohortCard cohort={{ code, id: "c-3", name: "Cohort 3" }} />);

    expect(
      screen.getByRole("link", { name: "Cohort 3" }).querySelector("p"),
    ).toBeNull();
  });

  it("shows a present code under the cohort name", () => {
    render(<CohortCard cohort={{ code: "C3", id: "c-3", name: "Cohort 3" }} />);

    expect(screen.getByText("C3").tagName).toBe("P");
  });
});
