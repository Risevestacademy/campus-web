import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render as renderUi,
  screen,
  within,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { presenceFor } from "@/core/presence";
import type { Avatar } from "@/core/realtime";

import type { PeopleView } from "../services/people-view.service";
import type { PeopleQuery, PeopleViewer, Person } from "../types/people.types";
import { PeopleAdministrationView } from "./people-administration";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// The row menu's mutations need a query client; a wrapper keeps it across
// `rerender`.
function render(ui: ReactElement) {
  const client = new QueryClient();
  return renderUi(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

const VIEWER: PeopleViewer = { id: "viewer", systemRole: "admin" };

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
    avatarUrl: null,
    systemRole: "user",
    status: "active",
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
    statusUntil: null,
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
      spaces: [],
    });
}

afterEach(() => presenceFor("people-cohort").getState().clear());

describe("People page", () => {
  it("has no header count and no attendance, check-in or Classroom parts", () => {
    render(
      <PeopleAdministrationView
        viewer={VIEWER}
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
    ).toEqual(["Name", "Role", "Track", "Status", "Actions"]);
  });

  it("names the role chips with their counts and says professor, not instructor", () => {
    render(
      <PeopleAdministrationView
        viewer={VIEWER}
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
        viewer={VIEWER}
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

    const row = (name: string) =>
      within(screen.getByRole("row", { name: new RegExp(name) }));
    expect(row("ADA").getByText("Available")).toBeVisible();
    expect(row("BOLA").getByText("Busy")).toBeVisible();
    expect(row("CHI").getByText("Away")).toBeVisible();
    expect(row("DEE").getByText("Offline")).toBeVisible();
  });

  it("links a person's name to their page", () => {
    render(
      <PeopleAdministrationView
        viewer={VIEWER}
        cohortId="people-cohort"
        query={QUERY}
        view={view([person("ada")])}
      />,
    );

    expect(screen.getByRole("link", { name: "ADA" })).toHaveAttribute(
      "href",
      "/campus/people-cohort/people/ada",
    );
  });

  it("marks a suspended member and does not link them to a page that cannot open", () => {
    render(
      <PeopleAdministrationView
        viewer={VIEWER}
        cohortId="people-cohort"
        query={QUERY}
        view={view([person("ada", { status: "suspended" }), person("bola")])}
      />,
    );

    const row = screen.getByRole("row", { name: /ADA/ });
    expect(within(row).getByText("Suspended")).toBeVisible();
    expect(within(row).queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "BOLA" })).toBeInTheDocument();
  });

  it("badges a system administrator as Admin whatever their cohort role", () => {
    render(
      <PeopleAdministrationView
        viewer={VIEWER}
        cohortId="people-cohort"
        query={QUERY}
        view={view([person("ada", { systemRole: "admin", role: "student" })])}
      />,
    );

    const row = screen.getByRole("row", { name: /ADA/ });
    expect(within(row).getByText("Admin")).toBeVisible();
    expect(within(row).queryByText("Student")).not.toBeInTheDocument();
  });

  it("does not call anyone offline before the first snapshot", () => {
    render(
      <PeopleAdministrationView
        viewer={VIEWER}
        cohortId="people-cohort"
        query={QUERY}
        view={view([person("ada")])}
      />,
    );

    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("stops calling people offline when the socket closes, until the next snapshot", () => {
    seed("people-cohort", [avatar("ada", "available")]);
    render(
      <PeopleAdministrationView
        viewer={VIEWER}
        cohortId="people-cohort"
        query={QUERY}
        view={view([person("ada"), person("bola")])}
      />,
    );
    expect(screen.getByText("Offline")).toBeInTheDocument();

    act(() =>
      presenceFor("people-cohort").getState().clearRemoteParticipants(),
    );

    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    expect(screen.queryByText("Available")).not.toBeInTheDocument();

    act(() => seed("people-cohort", [avatar("ada", "available")]));

    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("follows a status change", () => {
    seed("people-cohort", [avatar("ada", "available")]);
    render(
      <PeopleAdministrationView
        viewer={VIEWER}
        cohortId="people-cohort"
        query={QUERY}
        view={view([person("ada")])}
      />,
    );

    act(() =>
      presenceFor("people-cohort").getState().apply({
        type: "statusChanged",
        userId: "ada",
        status: "busy",
        until: null,
      }),
    );

    expect(screen.getByText("Busy")).toBeInTheDocument();
  });

  it("says when the list cannot load and when nobody matches", () => {
    const { rerender } = render(
      <PeopleAdministrationView
        viewer={VIEWER}
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
        viewer={VIEWER}
        cohortId="people-cohort"
        query={QUERY}
        view={view([])}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No one matches.");
  });

  it("offers the account actions on other rows and none on your own", () => {
    render(
      <PeopleAdministrationView
        viewer={VIEWER}
        cohortId="people-cohort"
        query={QUERY}
        view={view([
          person("viewer", { systemRole: "admin" }),
          person("ada"),
          person("bola", { status: "suspended" }),
        ])}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Manage VIEWER" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Manage ADA" }));
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Promote to admin", "Suspend"]);
  });

  it("lets you reinstate a suspended member from the list, since they have no page", () => {
    render(
      <PeopleAdministrationView
        viewer={VIEWER}
        cohortId="people-cohort"
        query={QUERY}
        view={view([person("bola", { status: "suspended" })])}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Manage BOLA" }));
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Promote to admin", "Reinstate"]);
  });
});
