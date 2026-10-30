import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { presenceFor } from "@/core/presence";

import type { Person } from "../types/people.types";
import { PersonDetail } from "./person-detail";

const COHORT_ID = "person-cohort";

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: "user-1",
    email: "ada@campus.local",
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: null,
    systemRole: "user",
    status: "active",
    role: "student",
    trackName: "Backend",
    ...overrides,
  };
}

function renderDetail(who: Person = person()) {
  return render(
    <PersonDetail cohortId={COHORT_ID} cohortName="Cohort 2" person={who} />,
  );
}

afterEach(() => presenceFor(COHORT_ID).getState().clear());

describe("PersonDetail", () => {
  it("names the person, their role, track and cohort, and links their email", () => {
    renderDetail();

    expect(
      screen.getByRole("heading", { level: 1, name: "Ada Lovelace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Student · Backend · Cohort 2")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "Email Ada" })[0],
    ).toHaveAttribute("href", "mailto:ada@campus.local");
    expect(screen.getByRole("link", { name: "People" })).toHaveAttribute(
      "href",
      `/campus/${COHORT_ID}/people`,
    );
  });

  it("badges a system administrator as Admin, as the list does", () => {
    renderDetail(person({ systemRole: "super_admin" }));

    const profile = screen.getByText("ada@campus.local").closest("p");
    expect(within(profile as HTMLElement).getByText("Admin")).toBeVisible();
    expect(within(profile as HTMLElement).queryByText("Student")).toBeNull();
  });

  it("badges an ordinary member with their cohort role", () => {
    renderDetail(person({ role: "mentor" }));

    const profile = screen.getByText("ada@campus.local").closest("p");
    expect(within(profile as HTMLElement).getByText("Mentor")).toBeVisible();
  });

  it("shows live status and follows it", () => {
    presenceFor(COHORT_ID)
      .getState()
      .apply({
        type: "snapshot",
        map: { id: "campus", version: "v1", width: 10, height: 10 },
        players: [
          {
            userId: "user-1",
            x: 0,
            y: 0,
            facing: "down",
            displayName: "Ada",
            spriteKey: null,
            status: "available",
            spaceKey: "_default",
          },
        ],
      });
    renderDetail();
    expect(screen.getByText("Available")).toBeVisible();

    act(() =>
      presenceFor(COHORT_ID)
        .getState()
        .apply({ type: "statusChanged", userId: "user-1", status: "away" }),
    );

    expect(screen.getByText("Away")).toBeVisible();
  });

  it("keeps the placeholder blocks, with no Rise Classroom parts", () => {
    renderDetail();

    expect(
      screen.getByRole("heading", { name: "Attendance history" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "On campus" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Ask mentor to check in" }),
    ).toBeDisabled();
    expect(screen.queryByText(/classroom/i)).not.toBeInTheDocument();
  });
});
