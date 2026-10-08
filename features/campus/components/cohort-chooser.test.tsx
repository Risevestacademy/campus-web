import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CohortChooser, type CohortViewer } from "../index";

const member: CohortViewer = {
  memberships: [
    { cohortId: "c-3", cohort: { name: "Cohort 3", code: "C3" } },
    { cohortId: "c-4", cohort: { name: "Cohort 4", code: "C4" } },
  ],
};

function cohortLinks() {
  return screen
    .getAllByRole("link")
    .filter((link) => /^\/campus\/[^?]+$/.test(link.getAttribute("href") ?? ""))
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

describe("CohortChooser", () => {
  it("offers each of the member's Cohorts", () => {
    render(<CohortChooser viewer={member} />);

    expect(cohortLinks()).toEqual([
      ["Cohort 3C3", "/campus/c-3"],
      ["Cohort 4C4", "/campus/c-4"],
    ]);
  });

  it("points a member without a Cohort to an Invitation", () => {
    render(<CohortChooser viewer={{ ...member, memberships: [] }} />);

    expect(
      screen.getByText(
        "You're not in a cohort yet. Ask your programme admin for an invite.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create cohort" }),
    ).not.toBeInTheDocument();
  });
});
