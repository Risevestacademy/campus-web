import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CohortAdministrationOverview } from "./cohort-administration-overview";

function renderOverview(adminName?: string | null) {
  return render(
    <CohortAdministrationOverview cohortId="c-1" adminName={adminName} />,
  );
}

describe("CohortAdministrationOverview", () => {
  it("greets the administrator by first name", () => {
    renderOverview("Jerry Okafor");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /^(Good morning|Good afternoon|Good evening), Jerry$/,
      }),
    ).toBeVisible();
  });

  it("greets without a name when the account has none", () => {
    renderOverview(null);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /^(Good morning|Good afternoon|Good evening)$/,
      }),
    ).toBeVisible();
  });

  it("shows the four headline figures without trend comparisons", () => {
    renderOverview("Jerry");

    for (const label of [
      "Online now",
      "Live now",
      "Attendance",
      "Needs review",
    ]) {
      expect(screen.getByText(label)).toBeVisible();
    }
    expect(screen.queryByText(/vs last/)).not.toBeInTheDocument();
  });

  it("lists what needs attention and today's schedule", () => {
    renderOverview("Jerry");

    const attention = screen.getByRole("region", { name: "Needs attention" });
    expect(within(attention).getAllByRole("listitem")).toHaveLength(3);

    const today = screen.getByRole("region", { name: "Today" });
    expect(within(today).getAllByRole("listitem")).toHaveLength(4);
    expect(within(today).getByText("LIVE")).toBeVisible();
  });

  it("leaves out the campus analytics panels", () => {
    renderOverview("Jerry");

    for (const name of [
      "Campus right now",
      "Attendance and participation",
      "When campus is busiest",
      "Attendance by track",
    ]) {
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
  });

  it("links to the Active Campus and the Programme Tracks page", () => {
    renderOverview("Jerry");

    expect(screen.getByRole("link", { name: "Open campus" })).toHaveAttribute(
      "href",
      "/campus/c-1",
    );
    expect(
      screen.getByRole("link", { name: /Programme Tracks/ }),
    ).toHaveAttribute("href", "/campus/c-1/tracks");
  });
});
