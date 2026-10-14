import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MeetingMediaTransport } from "../services/media-session/contracts";
import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import { createAdmissionStore } from "../services/presence-session/admission-store";
import { AdmissionProvider } from "../services/presence-session/presence-session-provider";
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

function presenceGate(admissionStore = createAdmissionStore()) {
  const connect = vi.fn<MeetingMediaTransport["connect"]>(
    () => () => undefined,
  );
  const mediaStore = createMediaSessionStore({
    mediaDevices: null,
    transport: { connect, handleLocalPublicationChange() {} },
  });

  return {
    admissionStore,
    connect,
    view: (
      <AdmissionProvider store={admissionStore}>
        <MediaSessionProvider store={mediaStore}>
          <PresenceSessionGate cohortId="c-1">
            <p>Cohort page</p>
          </PresenceSessionGate>
        </MediaSessionProvider>
      </AdmissionProvider>
    ),
  };
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
    const { connect, view } = presenceGate();

    expect(() => render(view)).toThrowError(
      "NEXT_REDIRECT:/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting",
    );
    expect(screen.queryByText("Cohort page")).not.toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
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
    const { admissionStore, connect, view } = presenceGate();
    admissionStore.getState().grantEntry("/campus/c-1/meeting?tab=people");

    render(view);

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
});
