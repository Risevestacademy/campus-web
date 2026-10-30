import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { presenceFor } from "@/core/presence";
import type { ServerMessage } from "@/core/realtime";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

vi.mock("./presence-participants", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./presence-participants")>();
  return { toRosterParticipants: vi.fn(original.toRosterParticipants) };
});

import { CampusOverview } from "./campus-overview";
import { CampusOverviewPanel } from "./campus-overview-panel";
import { toRosterParticipants } from "./presence-participants";
import { avatar, snapshot, welcome } from "./testing/world-messages";

let nextCohort = 0;

// The registry keeps one store per cohort for the whole file, so each test
// gets a cohort of its own.
function newCohort() {
  const cohortId = `cohort-${nextCohort++}`;
  const store = presenceFor(cohortId);
  const apply = (...messages: ServerMessage[]) =>
    act(() => messages.forEach((message) => store.getState().apply(message)));
  return { apply, cohortId, store };
}

function directory(
  cohortId: string,
  reply: () => Response | Promise<Response>,
) {
  mockApi.server.use(
    http.get(`${TEST_ORIGIN}/api/v1/cohorts/${cohortId}/profiles`, reply),
  );
}

function everyoneIn(cohortId: string, people: unknown[]) {
  directory(cohortId, () => HttpResponse.json(people));
}

function renderPanel(
  cohortId: string,
  props: Partial<React.ComponentProps<typeof CampusOverviewPanel>> = {},
) {
  return render(
    withQueryClient(
      <CampusOverviewPanel
        cohort={{ name: "Product Design 2026", role: "student" }}
        cohortId={cohortId}
        collapseButton={null}
        {...props}
      />,
    ),
  );
}

function rows(group: "Online" | "Offline") {
  const trigger = screen.getByRole("button", { name: new RegExp(group) });
  if (trigger.getAttribute("aria-expanded") === "false") {
    fireEvent.click(trigger);
  }
  return within(trigger.closest("[data-open]") as HTMLElement)
    .queryAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

afterEach(() => {
  onlineManager.setOnline(true);
  mockApi.reset();
  vi.mocked(toRosterParticipants).mockClear();
});
afterAll(() => mockApi.close());

describe("CampusOverviewPanel", () => {
  it("renders the collapse button passed in by the sidebar", () => {
    const { cohortId } = newCohort();
    directory(cohortId, () => new Response(null, { status: 500 }));

    renderPanel(cohortId, { collapseButton: <button>Collapse</button> });

    expect(screen.getByRole("button", { name: "Collapse" })).toBeVisible();
  });

  it("labels the sidebar with the cohort's name and the member's role", () => {
    const { cohortId } = newCohort();
    directory(cohortId, () => new Response(null, { status: 500 }));

    renderPanel(cohortId);

    expect(screen.getByText("Product Design 2026 · Student")).toBeVisible();
  });

  it("labels an administrator with no place in the cohort as one", () => {
    const { cohortId } = newCohort();
    directory(cohortId, () => new Response(null, { status: 500 }));

    renderPanel(cohortId, { cohort: undefined });

    expect(screen.getByText("Administrator")).toBeVisible();
  });

  describe("who is online", () => {
    it("lists each person once from the snapshot, the member first", () => {
      const { apply, cohortId } = newCohort();
      directory(cohortId, () => new Response(null, { status: 500 }));
      apply(
        welcome("grace"),
        snapshot(
          avatar("ada", { displayName: "Ada" }),
          avatar("grace", { displayName: "Grace" }),
        ),
      );

      renderPanel(cohortId);

      expect(screen.getByRole("button", { name: "Online 2" })).toBeVisible();
      expect(rows("Online")).toEqual(["GGraceYou", "AAdaAvailable"]);
    });

    it("follows people joining and leaving without a reload", () => {
      const { apply, cohortId } = newCohort();
      directory(cohortId, () => new Response(null, { status: 500 }));
      apply(welcome("ada"), snapshot(avatar("ada", { displayName: "Ada" })));
      renderPanel(cohortId);

      apply({
        type: "joined",
        player: avatar("bola", { displayName: "Bola" }),
      });

      expect(screen.getByText("Bola")).toBeVisible();
      expect(screen.getByRole("button", { name: "Online 2" })).toBeVisible();

      apply({ type: "left", userId: "bola" });

      expect(screen.queryByText("Bola")).not.toBeInTheDocument();
    });

    it("shows a changed name", () => {
      const { apply, cohortId } = newCohort();
      directory(cohortId, () => new Response(null, { status: 500 }));
      apply(welcome("me"), snapshot(avatar("ada", { displayName: "Ada" })));
      renderPanel(cohortId);

      apply({
        type: "appearance",
        userId: "ada",
        displayName: "Ada L.",
        spriteKey: null,
      });

      expect(screen.getByText("Ada L.")).toBeVisible();
      expect(screen.queryByText("Ada")).not.toBeInTheDocument();
    });

    it("drops stale rows and adds no duplicates after a replacement snapshot", () => {
      const { apply, cohortId } = newCohort();
      directory(cohortId, () => new Response(null, { status: 500 }));
      apply(
        welcome("ada"),
        snapshot(
          avatar("ada", { displayName: "Ada" }),
          avatar("bola", { displayName: "Bola" }),
        ),
      );
      renderPanel(cohortId);

      apply(
        snapshot(
          avatar("ada", { displayName: "Ada" }),
          avatar("chi", { displayName: "Chi" }),
        ),
      );

      expect(rows("Online")).toEqual(["AAdaYou", "CChiAvailable"]);
    });

    it("names somebody with no display name a campus member, never by ID", () => {
      const { apply, cohortId } = newCohort();
      const id = "11111111-1111-4111-8111-111111111111";
      directory(cohortId, () => new Response(null, { status: 500 }));
      apply(welcome("me"), snapshot(avatar(id, { displayName: null })));

      renderPanel(cohortId);

      expect(screen.getByText("Campus member")).toBeVisible();
      expect(screen.queryByText(id)).not.toBeInTheDocument();
    });

    it("does not rebuild the list while people only move", () => {
      const { apply, cohortId, store } = newCohort();
      directory(cohortId, () => new Response(null, { status: 500 }));
      apply(welcome("ada"), snapshot(avatar("ada"), avatar("bola")));
      renderPanel(cohortId);
      const participants = store.getState().participants;
      const built = vi.mocked(toRosterParticipants).mock.calls.length;

      apply(
        {
          type: "moved",
          players: [{ userId: "bola", x: 5, y: 5, facing: "up" }],
        },
        {
          type: "moveResult",
          seq: 1,
          outcome: "moved",
          player: { userId: "ada", x: 2, y: 1, facing: "right" },
        },
      );

      expect(store.getState().participants).toBe(participants);
      expect(vi.mocked(toRosterParticipants)).toHaveBeenCalledTimes(built);
    });
  });

  describe("status and rooms", () => {
    function renderWithEveryStatus() {
      const { apply, cohortId } = newCohort();
      directory(cohortId, () => new Response(null, { status: 500 }));
      apply(
        welcome("me"),
        snapshot(
          avatar("me", { displayName: "Me" }),
          avatar("ada", { displayName: "Ada" }),
          avatar("bola", { displayName: "Bola", status: "busy" }),
          avatar("chi", { displayName: "Chi", status: "away" }),
          avatar("dayo", { displayName: "Dayo", spaceKey: "library" }),
        ),
      );
      renderPanel(cohortId);
      return apply;
    }

    it.each([
      ["All", ["Me", "Ada", "Bola", "Chi", "Dayo"]],
      ["Available", ["Me", "Ada", "Dayo"]],
      ["Busy", ["Bola"]],
      ["Away", ["Chi"]],
    ])("filters by %s", (filter, names) => {
      renderWithEveryStatus();

      fireEvent.click(screen.getByRole("button", { name: filter }));

      expect(
        rows("Online").map((row) =>
          row.slice(1).replace(/(You|Available|In a room|Busy|Away)$/, ""),
        ),
      ).toEqual(names);
    });

    it("moves somebody between filters as their status changes", () => {
      const apply = renderWithEveryStatus();
      fireEvent.click(screen.getByRole("button", { name: "Busy" }));

      apply({ type: "statusChanged", userId: "ada", status: "busy" });

      expect(rows("Online")).toEqual(["AAdaBusy", "BBolaBusy"]);

      apply({ type: "statusChanged", userId: "ada", status: "away" });
      fireEvent.click(screen.getByRole("button", { name: "Away" }));

      expect(rows("Online")).toEqual(["AAdaAway", "CChiAway"]);
    });

    it("says an available person is in a room, and offers no filter for it", () => {
      const apply = renderWithEveryStatus();

      apply({ type: "spaceChanged", userId: "ada", spaceKey: "library" });

      expect(rows("Online")).toContain("AAdaIn a room");
      expect(
        screen.queryByRole("button", { name: "In a room" }),
      ).not.toBeInTheDocument();
    });

    it.each([
      ["Me", "bg-success"],
      ["Bola", "bg-error"],
      ["Chi", "bg-warning"],
    ])("gives %s a %s dot", (name, dotClass) => {
      renderWithEveryStatus();

      const row = screen.getByText(name).closest("li") as HTMLElement;

      expect(row.querySelector('[data-slot="avatar-badge"]')).toHaveClass(
        dotClass,
      );
    });

    it("filters the roster as the participant is searched for", () => {
      renderWithEveryStatus();

      fireEvent.change(screen.getByPlaceholderText("Search participants"), {
        target: { value: "ayo" },
      });

      expect(screen.getByText("Dayo")).toBeVisible();
      expect(screen.queryByText("Ada")).not.toBeInTheDocument();
    });
  });

  describe("who is offline", () => {
    it("lists the cohort's other people, once each", async () => {
      const { apply, cohortId } = newCohort();
      everyoneIn(cohortId, [
        { id: "ada", displayName: "Ada", spriteKey: "placeholder-1" },
        { id: "bola", displayName: "Bola", spriteKey: null },
        { id: "chi", displayName: null, spriteKey: null },
      ]);
      apply(welcome("ada"), snapshot(avatar("ada", { displayName: "Ada" })));

      renderPanel(cohortId);

      expect(
        await screen.findByRole("button", { name: "Offline 2" }),
      ).toBeVisible();
      expect(rows("Offline")).toEqual(["BBola", "CCampus member"]);
    });

    it("gives offline people a grey dot and no detail line", async () => {
      const { apply, cohortId } = newCohort();
      everyoneIn(cohortId, [{ id: "bola", displayName: "Bola" }]);
      apply(welcome("ada"), snapshot(avatar("ada")));
      renderPanel(cohortId);
      await screen.findByRole("button", { name: "Offline 1" });
      rows("Offline");

      const row = screen.getByText("Bola").closest("li") as HTMLElement;

      expect(row.querySelector('[data-slot="avatar-badge"]')).toHaveClass(
        "bg-icon-muted",
      );
      expect(row.querySelectorAll("p")).toHaveLength(1);
    });

    it("hides the group when the socket closes, until a fresh snapshot arrives", async () => {
      const { apply, cohortId, store } = newCohort();
      everyoneIn(cohortId, [
        { id: "ada", displayName: "Ada", spriteKey: null },
        { id: "bola", displayName: "Bola", spriteKey: null },
      ]);
      apply(
        welcome("ada"),
        snapshot(
          avatar("ada", { displayName: "Ada" }),
          avatar("bola", { displayName: "Bola" }),
        ),
      );
      renderPanel(cohortId);
      expect(
        await screen.findByRole("button", { name: "Offline 0" }),
      ).toBeVisible();

      // The map is kept so the scene stays drawn, but nobody is known to be
      // online or offline while the socket is down.
      act(() => store.getState().clearRemoteParticipants());

      expect(screen.getByRole("button", { name: "Online 1" })).toBeVisible();
      expect(
        screen.queryByRole("button", { name: /Offline/ }),
      ).not.toBeInTheDocument();

      apply(snapshot(avatar("ada", { displayName: "Ada" })));

      expect(
        await screen.findByRole("button", { name: "Offline 1" }),
      ).toBeVisible();
      expect(rows("Offline")).toEqual(["BBola"]);
    });

    it("hides the group while the directory is fetched again, then shows the new one", async () => {
      const { apply, cohortId } = newCohort();
      everyoneIn(cohortId, [
        { id: "ada", displayName: "Ada", spriteKey: null },
        { id: "bola", displayName: "Bola", spriteKey: null },
      ]);
      apply(welcome("ada"), snapshot(avatar("ada", { displayName: "Ada" })));
      const client = new QueryClient();
      render(
        <QueryClientProvider client={client}>
          <CampusOverviewPanel
            cohort={{ name: "Product Design 2026", role: "student" }}
            cohortId={cohortId}
            collapseButton={null}
          />
        </QueryClientProvider>,
      );
      expect(
        await screen.findByRole("button", { name: "Offline 1" }),
      ).toBeVisible();

      const reply = Promise.withResolvers<void>();
      directory(cohortId, () =>
        reply.promise.then(() =>
          HttpResponse.json([
            { id: "ada", displayName: "Ada", spriteKey: null },
          ]),
        ),
      );
      act(() => {
        void client.invalidateQueries({ queryKey: ["roster", "directory"] });
      });

      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: /Offline/ }),
        ).not.toBeInTheDocument(),
      );

      reply.resolve();

      expect(
        await screen.findByRole("button", { name: "Offline 0" }),
      ).toBeVisible();
    });

    it("hides the group while a refetch waits for the network, then shows the new list", async () => {
      const { apply, cohortId } = newCohort();
      everyoneIn(cohortId, [
        { id: "ada", displayName: "Ada", spriteKey: null },
        { id: "bola", displayName: "Bola", spriteKey: null },
      ]);
      apply(welcome("ada"), snapshot(avatar("ada", { displayName: "Ada" })));
      const client = new QueryClient();
      render(
        <QueryClientProvider client={client}>
          <CampusOverviewPanel
            cohort={{ name: "Product Design 2026", role: "student" }}
            cohortId={cohortId}
            collapseButton={null}
          />
        </QueryClientProvider>,
      );
      expect(
        await screen.findByRole("button", { name: "Offline 1" }),
      ).toBeVisible();

      // Offline, a refetch is paused rather than fetching, and the cached
      // directory would otherwise stay on screen.
      onlineManager.setOnline(false);
      everyoneIn(cohortId, [
        { id: "ada", displayName: "Ada", spriteKey: null },
      ]);
      act(() => {
        void client.invalidateQueries({ queryKey: ["roster", "directory"] });
      });

      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: /Offline/ }),
        ).not.toBeInTheDocument(),
      );
      expect(client.isFetching()).toBe(0);

      act(() => onlineManager.setOnline(true));

      expect(
        await screen.findByRole("button", { name: "Offline 0" }),
      ).toBeVisible();
    });

    it("does not offer the group while the directory loads", async () => {
      const { apply, cohortId } = newCohort();
      const reply = Promise.withResolvers<void>();
      const asked = Promise.withResolvers<void>();
      directory(cohortId, () => {
        asked.resolve();
        return reply.promise.then(() => HttpResponse.json([]));
      });
      apply(welcome("ada"), snapshot(avatar("ada")));

      renderPanel(cohortId);
      await asked.promise;

      expect(
        screen.queryByRole("button", { name: /Offline/ }),
      ).not.toBeInTheDocument();

      reply.resolve();

      expect(
        await screen.findByRole("button", { name: "Offline 0" }),
      ).toBeVisible();
    });

    it("hides the group when the directory cannot be read", async () => {
      const { apply, cohortId } = newCohort();
      let asked = false;
      directory(cohortId, () => {
        asked = true;
        return new Response(null, { status: 500 });
      });
      apply(welcome("ada"), snapshot(avatar("ada")));

      renderPanel(cohortId);

      await waitFor(() => expect(asked).toBe(true));
      expect(
        screen.queryByRole("button", { name: /Offline/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Online 1" })).toBeVisible();
    });

    it("hides the group when the directory is malformed", async () => {
      const { apply, cohortId } = newCohort();
      let asked = false;
      directory(cohortId, () => {
        asked = true;
        return HttpResponse.json([{ displayName: "No id" }]);
      });
      apply(welcome("ada"), snapshot(avatar("ada")));

      renderPanel(cohortId);

      await waitFor(() => expect(asked).toBe(true));
      expect(
        screen.queryByRole("button", { name: /Offline/ }),
      ).not.toBeInTheDocument();
    });

    it("waits for the snapshot before calling anybody offline", async () => {
      const { apply, cohortId } = newCohort();
      let asked = false;
      directory(cohortId, () => {
        asked = true;
        return HttpResponse.json([{ id: "bola", displayName: "Bola" }]);
      });

      renderPanel(cohortId);
      await waitFor(() => expect(asked).toBe(true));

      expect(
        screen.queryByRole("button", { name: /Offline/ }),
      ).not.toBeInTheDocument();

      apply(welcome("ada"), snapshot(avatar("ada")));

      expect(
        await screen.findByRole("button", { name: "Offline 1" }),
      ).toBeVisible();
    });

    it("lists offline people only under All, and finds them by search", async () => {
      const { apply, cohortId } = newCohort();
      everyoneIn(cohortId, [{ id: "bola", displayName: "Bola" }]);
      apply(welcome("ada"), snapshot(avatar("ada")));
      renderPanel(cohortId);
      await screen.findByRole("button", { name: "Offline 1" });

      fireEvent.change(screen.getByPlaceholderText("Search participants"), {
        target: { value: "bol" },
      });
      expect(rows("Offline")).toEqual(["BBola"]);

      fireEvent.click(screen.getByRole("button", { name: "Available" }));
      expect(rows("Offline")).toEqual([]);
    });
  });

  it("collapses the offline group independently from the online group", async () => {
    const { apply, cohortId } = newCohort();
    everyoneIn(cohortId, []);
    apply(welcome("ada"), snapshot(avatar("ada")));
    renderPanel(cohortId);

    const onlineTrigger = screen.getByRole("button", { name: "Online 1" });
    const offlineTrigger = await screen.findByRole("button", {
      name: "Offline 0",
    });

    expect(onlineTrigger).toHaveAttribute("aria-expanded", "true");
    expect(offlineTrigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(offlineTrigger);

    expect(offlineTrigger).toHaveAttribute("aria-expanded", "true");
    expect(onlineTrigger).toHaveAttribute("aria-expanded", "true");
  });
});

describe("the search shortcut", () => {
  function renderOverview() {
    render(
      <CampusOverview
        collapseButton={null}
        contextLabel="Engineering · Mentor"
        participants={[]}
      />,
    );
    return screen.getByPlaceholderText("Search participants");
  }

  function press(init: KeyboardEventInit) {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    document.body.dispatchEvent(event);
    return event;
  }

  it("focuses the search on Ctrl F and keeps the browser's find from opening", () => {
    const search = renderOverview();

    const event = press({ key: "f", ctrlKey: true });

    expect(search).toHaveFocus();
    expect(event.defaultPrevented).toBe(true);
  });

  it("answers a capital F as well", () => {
    const search = renderOverview();

    press({ key: "F", ctrlKey: true });

    expect(search).toHaveFocus();
  });

  it("takes the shortcut before anything listening lower down", () => {
    renderOverview();
    const lowerDown = vi.fn();
    document.body.addEventListener("keydown", lowerDown);

    press({ key: "f", ctrlKey: true });

    document.body.removeEventListener("keydown", lowerDown);
    expect(lowerDown).toHaveBeenCalledTimes(1);
    expect(lowerDown.mock.calls[0]?.[0].defaultPrevented).toBe(true);
  });

  it.each([
    ["plain F", { key: "f" }],
    ["Cmd F", { key: "f", metaKey: true }],
    ["Ctrl Shift F", { key: "f", ctrlKey: true, shiftKey: true }],
    ["Ctrl Alt F", { key: "f", ctrlKey: true, altKey: true }],
    ["Ctrl G", { key: "g", ctrlKey: true }],
  ])("leaves %s alone", (_, init) => {
    const search = renderOverview();

    const event = press(init);

    expect(search).not.toHaveFocus();
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves the browser's find alone behind a modal", () => {
    const search = renderOverview();
    search.parentElement?.setAttribute("aria-hidden", "true");

    const event = press({ key: "f", ctrlKey: true });

    expect(search).not.toHaveFocus();
    expect(event.defaultPrevented).toBe(false);
  });

  it("stops listening once the sidebar panel is gone", () => {
    const { unmount } = render(
      <CampusOverview
        collapseButton={null}
        contextLabel="Engineering · Mentor"
        participants={[]}
      />,
    );
    unmount();

    expect(press({ key: "f", ctrlKey: true }).defaultPrevented).toBe(false);
  });
});

describe("CampusOverview", () => {
  const zora = {
    id: "zora",
    name: "Zora",
    initial: "Z",
    avatarClassName: "",
    status: "available",
    detail: "Available",
  } as const;

  it("renders injected participant, context, and offline state", () => {
    render(
      <CampusOverview
        collapseButton={null}
        contextLabel="Engineering · Mentor"
        offlineParticipants={[
          { ...zora, id: "yemi", name: "Yemi", status: "offline" },
        ]}
        participants={[zora]}
      />,
    );

    expect(screen.getByText("Engineering · Mentor")).toBeVisible();
    expect(screen.getByRole("button", { name: "Online 1" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Offline 1" })).toBeVisible();
    expect(screen.getByText("Zora")).toBeVisible();
  });

  it("leaves the offline group out when none is given", () => {
    render(
      <CampusOverview
        collapseButton={null}
        contextLabel="Engineering · Mentor"
        participants={[zora]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Offline/ }),
    ).not.toBeInTheDocument();
  });

  it("reports participant and quick-transport intents", () => {
    const onParticipantAction = vi.fn();
    const onQuickTransport = vi.fn();

    render(
      <CampusOverview
        collapseButton={null}
        contextLabel="Engineering · Mentor"
        onParticipantAction={onParticipantAction}
        onQuickTransport={onQuickTransport}
        participants={[zora]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Wave Zora", hidden: true }),
    );
    fireEvent.click(screen.getByText("Now & next"));

    expect(onParticipantAction).toHaveBeenCalledWith(
      "wave",
      expect.objectContaining({ id: "zora" }),
    );
    expect(onQuickTransport).toHaveBeenCalledWith(
      expect.objectContaining({ id: "now-next" }),
    );
  });

  it("gives offline people no actions", () => {
    render(
      <CampusOverview
        collapseButton={null}
        contextLabel="Engineering · Mentor"
        offlineParticipants={[{ ...zora, status: "offline" }]}
        participants={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Offline 1" }));

    expect(
      screen.queryByRole("button", { name: "Wave Zora", hidden: true }),
    ).not.toBeInTheDocument();
  });
});
