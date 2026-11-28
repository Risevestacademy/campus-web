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
import type {
  PeopleQuery,
  PeopleViewer,
  Person,
  RosterMember,
} from "../types/people.types";
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
  scope: "current",
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
    trackId: "t-1",
    trackName: "Backend",
    accessExpiresAt: null,
    ...overrides,
  };
}

function view(people: Person[]): PeopleView {
  return {
    list: {
      scope: "current",
      kind: "loaded",
      people,
      page: 1,
      totalPages: 1,
      total: 6,
    },
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
        view={{ ...view([]), list: { scope: "current", kind: "unavailable" } }}
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
    ).toEqual([
      "Mark as graduated",
      "Defer",
      "Withdraw",
      "Dismiss",
      "Remove from cohort",
      "Promote to admin",
      "Suspend",
    ]);
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
    ).toEqual([
      "Mark as graduated",
      "Defer",
      "Withdraw",
      "Dismiss",
      "Remove from cohort",
      "Promote to admin",
      "Reinstate",
    ]);
  });

  it("offers a student the cohort's other tracks and a guest an extension", () => {
    render(
      <PeopleAdministrationView
        viewer={VIEWER}
        cohortId="people-cohort"
        query={QUERY}
        view={{
          ...view([
            person("ada"),
            person("gus", {
              role: "guest",
              trackId: null,
              trackName: null,
              accessExpiresAt: "2026-12-05T12:00:00.000Z",
            }),
            person("pat", { role: "professor", trackId: null }),
          ]),
          tracks: {
            kind: "loaded",
            tracks: [
              { id: "t-1", name: "Backend" },
              { id: "t-2", name: "Design" },
            ],
          },
        }}
      />,
    );

    const itemsOf = (name: string) => {
      fireEvent.click(screen.getByRole("button", { name: `Manage ${name}` }));
      const items = screen
        .getAllByRole("menuitem")
        .map((item) => item.textContent);
      fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
      return items;
    };

    expect(itemsOf("ADA")).toContain("Change track");
    expect(itemsOf("GUS")).toEqual([
      "Extend visit",
      "Remove from cohort",
      "Promote to admin",
      "Suspend",
    ]);
    expect(itemsOf("PAT")).toEqual([
      "Remove from cohort",
      "Promote to admin",
      "Suspend",
    ]);
  });

  it("lists former members with how their place ended, unlinked and without a menu", () => {
    const former: RosterMember[] = [
      {
        role: "student",
        status: "dismissed",
        dismissalReason: "Posted the answer to a live assessment.",
        leftAt: "2026-10-13T12:00:00.000Z",
        accessExpiresAt: null,
        user: {
          id: "dee",
          email: "dee@campus.local",
          firstName: "Dee",
          lastName: null,
          displayName: null,
          avatarUrl: null,
        },
        track: { name: "Backend" },
      },
      {
        role: "guest",
        status: null,
        dismissalReason: null,
        leftAt: null,
        accessExpiresAt: "2026-10-20T12:00:00.000Z",
        user: {
          id: "gwen",
          email: "gwen@campus.local",
          firstName: "Gwen",
          lastName: null,
          displayName: null,
          avatarUrl: null,
        },
        track: null,
      },
      {
        role: "mentor",
        status: null,
        dismissalReason: null,
        leftAt: "2026-11-02T09:00:00.000Z",
        accessExpiresAt: null,
        user: {
          id: "mo",
          email: "mo@campus.local",
          firstName: "Mo",
          lastName: null,
          displayName: null,
          avatarUrl: null,
        },
        track: null,
      },
    ];

    render(
      <PeopleAdministrationView
        viewer={VIEWER}
        cohortId="people-cohort"
        query={{ ...QUERY, scope: "former" }}
        view={{
          ...view([]),
          list: {
            scope: "former",
            kind: "loaded",
            members: former,
            page: 1,
            totalPages: 1,
            total: 3,
          },
        }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Former members" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.queryByRole("searchbox", { name: "Search by name or email" }),
    ).not.toBeInTheDocument();

    const rows = within(
      screen.getByRole("table", { name: "Former members" }),
    ).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Dismissed");
    expect(rows[1]).toHaveTextContent(
      "Posted the answer to a live assessment.",
    );
    expect(rows[1]).toHaveTextContent("13 Oct 2026");
    expect(rows[2]).toHaveTextContent("Visit ended");
    expect(rows[2]).toHaveTextContent("20 Oct 2026");
    expect(rows[3]).toHaveTextContent("Removed");

    expect(screen.queryByRole("link", { name: "Dee" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Manage / }),
    ).not.toBeInTheDocument();
  });

  it("keeps the role chips on the Former members list", () => {
    render(
      <PeopleAdministrationView
        viewer={VIEWER}
        cohortId="people-cohort"
        query={{ ...QUERY, scope: "former" }}
        view={view([])}
      />,
    );

    expect(screen.getByRole("link", { name: "Students 4" })).toHaveAttribute(
      "href",
      "/campus/people-cohort/people?members=former&role=student",
    );
  });
});
