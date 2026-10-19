import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MeetingMediaTransport } from "../services/media-session/contracts";
import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import { createAdmissionStore } from "../services/presence-session/admission-store";
import {
  AdmissionProvider,
  PresenceTabProvider,
} from "../services/presence-session/presence-session-provider";
import type { PresenceTabStatus } from "../services/presence-session/presence-tab";
import { WorldSessionProvider } from "../services/world-session/world-session-provider";
import { createTestPresenceTab } from "../testing/presence-tab-test-utils";
import { createTestWorldSession } from "../testing/world-session-test-utils";
import { PresenceSessionGate } from "./presence-session-gate";

const navigation = vi.hoisted(() => ({
  pathname: "/campus/c-1/meeting",
  redirect: vi.fn((href: string): never => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  redirect: navigation.redirect,
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}));

function presenceGate(
  admissionStore = createAdmissionStore(),
  status: PresenceTabStatus = "held",
) {
  const connect = vi.fn<MeetingMediaTransport["connect"]>(
    () => () => undefined,
  );
  const mediaStore = createMediaSessionStore({
    mediaDevices: null,
    transport: { connect, handleLocalPublicationChange() {} },
  });
  const presenceTab = createTestPresenceTab(status);
  const world = createTestWorldSession();

  return {
    admissionStore,
    connect,
    mediaStore,
    presenceTab,
    world,
    view: (
      <AdmissionProvider store={admissionStore}>
        <MediaSessionProvider store={mediaStore}>
          <PresenceTabProvider tab={presenceTab}>
            <WorldSessionProvider world={world}>
              <PresenceSessionGate cohortId="c-1">
                <p>Cohort page</p>
              </PresenceSessionGate>
            </WorldSessionProvider>
          </PresenceTabProvider>
        </MediaSessionProvider>
      </AdmissionProvider>
    ),
  };
}

// What followPresenceTab does to the session when another tab takes it.
function takeOverFromAnotherTab(gate: ReturnType<typeof presenceGate>) {
  act(() => {
    gate.mediaStore.getState().stop();
    gate.admissionStore.getState().clear();
    gate.world.close();
    gate.presenceTab.setStatus("taken-over");
  });
}

// What world's 4000 and followWorldOutcome do to the session.
function enterFromAnotherDevice(gate: ReturnType<typeof presenceGate>) {
  act(() => {
    gate.mediaStore.getState().stop();
    gate.admissionStore.getState().clear();
    gate.world.stop("entered-elsewhere");
  });
}

describe("PresenceSessionGate", () => {
  beforeEach(() => {
    navigation.pathname = "/campus/c-1/meeting";
    navigation.searchParams = new URLSearchParams();
    navigation.redirect.mockClear();
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("redirects an unjoined deep link through pre-join without connecting", () => {
    const { connect, view, world } = presenceGate();

    expect(() => render(view)).toThrowError(
      "NEXT_REDIRECT:/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting",
    );
    expect(screen.queryByText("Cohort page")).not.toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
    expect(world.connects()).toBe(0);
  });

  it("returns an unjoined administration page through pre-join to itself", () => {
    navigation.pathname = "/campus/c-1/overview";
    const { view } = presenceGate();

    expect(() => render(view)).toThrowError(
      "NEXT_REDIRECT:/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Foverview",
    );
  });

  it("does not admit a copied completion marker", () => {
    navigation.searchParams = new URLSearchParams(
      "tab=people&prejoin=complete",
    );
    const { view } = presenceGate();

    expect(() => render(view)).toThrowError(
      "NEXT_REDIRECT:/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting%3Ftab%3Dpeople",
    );
  });

  it("admits the exact pending destination and connects the session to the cohort", () => {
    navigation.searchParams = new URLSearchParams("tab=people");
    const { admissionStore, connect, view, world } = presenceGate();
    admissionStore.getState().grantEntry("/campus/c-1/meeting?tab=people");

    render(view);

    expect(world.connects()).toBe(1);
    expect(screen.getByText("Cohort page")).toBeVisible();
    expect(admissionStore.getState()).toMatchObject({
      admitted: true,
      pendingDestination: null,
    });
    expect(connect).toHaveBeenCalledExactlyOnceWith(
      "c-1",
      expect.any(Function),
    );
  });

  it("rejects a mismatched destination without consuming it", () => {
    const { admissionStore, view } = presenceGate();
    admissionStore.getState().grantEntry("/campus/c-1");

    expect(() => render(view)).toThrowError(
      "NEXT_REDIRECT:/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting",
    );
    expect(admissionStore.getState().pendingDestination).toBe("/campus/c-1");
  });

  it("keeps internal navigation admitted while the gate stays mounted", () => {
    const { admissionStore, view } = presenceGate();
    admissionStore.getState().grantEntry("/campus/c-1/meeting");
    const rendered = render(view);

    navigation.pathname = "/campus/c-1";
    rendered.rerender(view);

    expect(screen.getByText("Cohort page")).toBeVisible();
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("admits another cohort page without reconnecting the session", () => {
    const { admissionStore, connect, view } = presenceGate();
    admissionStore.getState().grantEntry("/campus/c-1/meeting");
    const mapPage = render(view);
    mapPage.unmount();

    navigation.pathname = "/campus/c-1/overview";
    render(view);

    expect(screen.getByText("Cohort page")).toBeVisible();
    expect(navigation.redirect).not.toHaveBeenCalled();
    expect(connect).toHaveBeenCalledOnce();
  });

  describe("when another tab takes the session", () => {
    it("shows the choice instead of the page", () => {
      const gate = presenceGate();
      gate.admissionStore.getState().grantEntry("/campus/c-1/meeting");
      render(gate.view);

      takeOverFromAnotherTab(gate);

      expect(
        screen.getByRole("heading", { name: "You joined from another tab" }),
      ).toBeVisible();
      expect(screen.queryByText("Cohort page")).not.toBeInTheDocument();
    });

    it("re-admits the current page and connects once on Use here", async () => {
      navigation.searchParams = new URLSearchParams("tab=people");
      const gate = presenceGate();
      gate.admissionStore
        .getState()
        .grantEntry("/campus/c-1/meeting?tab=people");
      render(gate.view);
      takeOverFromAnotherTab(gate);
      gate.connect.mockClear();

      fireEvent.click(screen.getByRole("button", { name: "Use here" }));

      expect(await screen.findByText("Cohort page")).toBeVisible();
      expect(gate.presenceTab.takeOver).toHaveBeenCalledOnce();
      expect(gate.world.connects()).toBe(2);
      expect(gate.admissionStore.getState()).toMatchObject({
        admitted: true,
        pendingDestination: null,
      });
      expect(gate.connect).toHaveBeenCalledExactlyOnceWith(
        "c-1",
        expect.any(Function),
      );
    });

    it("never connects before the session has moved", () => {
      const gate = presenceGate();
      gate.admissionStore.getState().grantEntry("/campus/c-1/meeting");
      render(gate.view);
      takeOverFromAnotherTab(gate);
      gate.connect.mockClear();
      gate.presenceTab.takeOver.mockReturnValue(new Promise<boolean>(() => {}));

      fireEvent.click(screen.getByRole("button", { name: "Use here" }));

      expect(gate.connect).not.toHaveBeenCalled();
      expect(gate.admissionStore.getState().admitted).toBe(false);
    });

    it("offers the choice on a cohort page reached after the takeover", async () => {
      navigation.pathname = "/campus/c-1/overview";
      const gate = presenceGate(createAdmissionStore(), "taken-over");
      render(gate.view);

      expect(navigation.redirect).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Use here" }));

      expect(await screen.findByText("Cohort page")).toBeVisible();
      expect(navigation.redirect).not.toHaveBeenCalled();
      expect(gate.connect).toHaveBeenCalledOnce();
    });
  });

  describe("when the member opens the campus on another device", () => {
    function joinedGate() {
      const gate = presenceGate();
      gate.admissionStore.getState().grantEntry("/campus/c-1/meeting");
      render(gate.view);
      enterFromAnotherDevice(gate);
      gate.connect.mockClear();
      return gate;
    }

    it("shows the choice in world's words instead of the page", () => {
      joinedGate();

      expect(
        screen.getByRole("heading", {
          name: "You opened this campus somewhere else",
        }),
      ).toBeVisible();
      expect(screen.queryByText("Cohort page")).not.toBeInTheDocument();
    });

    it("rejoins here by racing for the lock this tab released", async () => {
      const gate = joinedGate();

      fireEvent.click(screen.getByRole("button", { name: "Use here" }));

      // entered-elsewhere releases the Web Lock before clearing the session,
      // so joining again here is exactly what any other tab joining a vacant
      // campus does: one takeOver() race.
      expect(await screen.findByText("Cohort page")).toBeVisible();
      expect(gate.presenceTab.takeOver).toHaveBeenCalledOnce();
      expect(gate.world.reconnects()).toBe(1);
      expect(gate.admissionStore.getState().admitted).toBe(true);
      expect(gate.connect).toHaveBeenCalledExactlyOnceWith(
        "c-1",
        expect.any(Function),
      );
    });

    it("never reconnects world when another cohort page mounts", () => {
      const gate = joinedGate();
      gate.admissionStore.getState().grantEntry("/campus/c-1/overview");
      navigation.pathname = "/campus/c-1/overview";

      render(gate.view);

      expect(gate.world.getStatus()).toEqual({
        phase: "closed",
        outcome: "entered-elsewhere",
      });
      expect(gate.world.reconnects()).toBe(0);
    });
  });
});
