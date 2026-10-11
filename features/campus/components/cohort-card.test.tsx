import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CohortCard } from "../index";

describe("CohortCard", () => {
  it("always links cohort selection to its pre-join screen", () => {
    render(
      <CohortCard
        cohort={{
          id: "11111111-1111-4111-8111-111111111111",
          name: "Cohort 3",
          code: "C3",
        }}
      />,
    );

    expect(screen.getByRole("link", { name: /Cohort 3/ })).toHaveAttribute(
      "href",
      "/campus/11111111-1111-4111-8111-111111111111/join",
    );
  });

  it("shows the cohort name and code", () => {
    render(<CohortCard cohort={{ id: "c-3", name: "Cohort 3", code: "C3" }} />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Cohort 3" }),
    ).toBeInTheDocument();
    expect(screen.getByText("C3")).toBeInTheDocument();
  });
});
