import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { presenceFor } from "@/core/presence";
import type { Avatar } from "@/core/realtime";

import type { PeopleView } from "../services/people-view.service";
import type { PeopleQuery, Person } from "../types/people.types";
import { PeopleAdministrationView } from "./people-administration";

vi.mock("server-only", () => ({}));

const QUERY: PeopleQuery = {
  chip: "all",
  search: undefined,
  trackId: undefined,
  page: 1,
};

function person(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    email: `${id}@campus.local`,
    firstName: null,
    lastName: null,
    displayName: id.toUpperCase(),
    systemRole: "user",
    role: "student",
    trackName: "Backend",
    ...overrides,
  };
}

function view(people: Person[]): PeopleView {
  return {
    list: { kind: "loaded", people, page: 1, totalPages: 1, total: 6 },
    counts: { all: 6, student: 4, professor: 1, mentor: 1 },
    tracks: { kind: "loaded", tracks: [{ id: "t-1", name: "Backend" }] },
  };
}

function avatar(userId: string, status: Avatar["status"]): Avatar {
  return {
    userId,
    x: 0,
    y: 0,
    facing: "down",
    displayName: userId,
    spriteKey: null,
    status,
    spaceKey: "_default",
  };
}

function seed(cohortId: string, players: Avatar[]) {
  presenceFor(cohortId)
    .getState()
    .apply({
      type: "snapshot",
      map: { id: "campus", version: "v1", width: 10, height: 10 },
      players,
    });
}

afterEach(() => presenceFor("people-cohort").getState().clear());

describe("People page", () => {
  it("has no header count and no attendance, check-in or Classroom parts", () => {
    render(
      <PeopleAdministrationView
        cohortId="people-cohort"
        query={QUERY}
        view={view([person("ada")])}
      />,
    );

    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.queryByText(/synced from/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/classroom/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/export/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /attendance|check-ins/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Name", "Role", "Track", "Status"]);
  });

  it("names the role chips with their counts and says professor, not instructor", () => {
    render(
      <PeopleAdministrationView
        cohortId="people-cohort"
        query={{ ...QUERY, chip: "professor" }}
        view={view([person("grace", { role: "professor" })])}
      />,
    );

    const chips = within(
      screen.getByRole("navigation", { name: "Filter by role" }),
    );
    expect(chips.getByRole("link", { name: "All 6" })).toBeInTheDocument();
    expect(chips.getByRole("link", { name: "Professors 1" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.queryByText(/instructor/i)).not.toBeInTheDocument();
    expect(
      screen.getByText("Professor", { selector: "span" }),
    ).toBeInTheDocument();
  });

  it("shows each person's live status and offline for anyone not connected", () => {
    seed("people-cohort", [
      avatar("ada", "available"),
      avatar("bola", "busy"),
      avatar("chi", "away"),
    ]);

    render(
      <PeopleAdministrationView
        cohortId="people-cohort"
        query={QUERY}
        view={view([
          person("ada"),
          person("bola"),
          person("chi"),
          person("dee"),
        ])}
      />,
    );

    const status = (name: string) =>
      within(screen.getByRole("row", { name: new RegExp(name) })).getAllByRole(
        "cell",
      )[3]!.textContent;
    expect(status("ADA")).toBe("Available");
    expect(status("BOLA")).toBe("Busy");
    expect(status("CHI")).toBe("Away");
    expect(status("DEE")).toBe("Offline");
  });

  it("does not call anyone offline before the first snapshot", () => {
    render(
      <PeopleAdministrationView
        cohortId="people-cohort"
        query={QUERY}
        view={view([person("ada")])}
      />,
    );

    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("follows a status change", () => {
    seed("people-cohort", [avatar("ada", "available")]);
    render(
      <PeopleAdministrationView
        cohortId="people-cohort"
        query={QUERY}
        view={view([person("ada")])}
      />,
    );

    act(() =>
      presenceFor("people-cohort")
        .getState()
        .apply({ type: "statusChanged", userId: "ada", status: "busy" }),
    );

    expect(screen.getByText("Busy")).toBeInTheDocument();
  });

  it("says when the list cannot load and when nobody matches", () => {
    const { rerender } = render(
      <PeopleAdministrationView
        cohortId="people-cohort"
        query={QUERY}
        view={{ ...view([]), list: { kind: "unavailable" } }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load people.",
    );

    rerender(
      <PeopleAdministrationView
        cohortId="people-cohort"
        query={QUERY}
        view={view([])}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No one matches.");
  });
});
