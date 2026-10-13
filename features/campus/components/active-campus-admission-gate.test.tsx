import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CampusAdmissionProvider } from "../services/admission/campus-admission-provider";
import { createCampusAdmissionStore } from "../services/admission/campus-admission-store";
import { ActiveCampusAdmissionGate } from "./active-campus-admission-gate";

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

function admissionGate(store = createCampusAdmissionStore()) {
  return {
    store,
    view: (
      <CampusAdmissionProvider store={store}>
        <ActiveCampusAdmissionGate cohortId="c-1">
          <p>Active campus</p>
        </ActiveCampusAdmissionGate>
      </CampusAdmissionProvider>
    ),
  };
}

describe("ActiveCampusAdmissionGate", () => {
  beforeEach(() => {
    navigation.pathname = "/campus/c-1/meeting";
    navigation.searchParams = new URLSearchParams();
    navigation.redirect.mockClear();
    window.history.replaceState(null, "", navigation.pathname);
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("redirects an unmarked deep link through pre-join", () => {
    const { view } = admissionGate();

    expect(() => render(view)).toThrowError(
      "NEXT_REDIRECT:/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting",
    );

    expect(navigation.redirect).toHaveBeenCalledWith(
      "/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting",
    );
    expect(screen.queryByText("Active campus")).not.toBeInTheDocument();
  });

  it("does not admit a copied completion marker", () => {
    navigation.searchParams = new URLSearchParams(
      "tab=people&prejoin=complete",
    );

    const { view } = admissionGate();

    expect(() => render(view)).toThrowError(
      "NEXT_REDIRECT:/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting%3Ftab%3Dpeople",
    );

    expect(screen.queryByText("Active campus")).not.toBeInTheDocument();
  });

  it("does not admit an invalid marker", () => {
    navigation.searchParams = new URLSearchParams("prejoin=pending");

    const { view } = admissionGate();

    expect(() => render(view)).toThrowError(
      "NEXT_REDIRECT:/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting",
    );
  });

  it("admits and consumes the exact pending destination", () => {
    navigation.searchParams = new URLSearchParams("tab=people");
    const { store, view } = admissionGate();
    store.getState().grantActiveCampusEntry("/campus/c-1/meeting?tab=people");

    render(view);

    expect(screen.getByText("Active campus")).toBeVisible();
    expect(store.getState().pendingActiveCampusDestination).toBeNull();
    expect(store.getState().admittedCohortId).toBe("c-1");
  });

  it("rejects a mismatched destination without consuming it", () => {
    const { store, view } = admissionGate();
    store.getState().grantActiveCampusEntry("/campus/c-1");

    expect(() => render(view)).toThrowError(
      "NEXT_REDIRECT:/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting",
    );
    expect(store.getState().pendingActiveCampusDestination).toBe("/campus/c-1");
  });

  it("keeps internal navigation inside the mounted Active Campus admitted", () => {
    const { store, view } = admissionGate();
    store.getState().grantActiveCampusEntry("/campus/c-1/meeting");
    const rendered = render(view);
    expect(store.getState().pendingActiveCampusDestination).toBeNull();

    navigation.pathname = "/campus/c-1";
    rendered.rerender(view);

    expect(screen.getByText("Active campus")).toBeVisible();
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("keeps the cohort admitted when Active Campus remounts", () => {
    const { store, view } = admissionGate();
    store.getState().grantActiveCampusEntry("/campus/c-1/meeting");
    const firstMount = render(view);
    expect(store.getState().pendingActiveCampusDestination).toBeNull();
    firstMount.unmount();

    render(view);

    expect(screen.getByText("Active campus")).toBeVisible();
    expect(navigation.redirect).not.toHaveBeenCalled();
  });
});
