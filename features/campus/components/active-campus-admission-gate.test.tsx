import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    expect(() =>
      render(
        <ActiveCampusAdmissionGate cohortId="c-1">
          <p>Active campus</p>
        </ActiveCampusAdmissionGate>,
      ),
    ).toThrowError(
      "NEXT_REDIRECT:/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting",
    );

    expect(navigation.redirect).toHaveBeenCalledWith(
      "/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting",
    );
    expect(screen.queryByText("Active campus")).not.toBeInTheDocument();
  });

  it("admits a completed pre-join visit and removes only its marker", () => {
    navigation.searchParams = new URLSearchParams(
      "tab=people&prejoin=complete",
    );
    window.history.replaceState(
      { retained: true },
      "",
      `${navigation.pathname}?${navigation.searchParams.toString()}`,
    );

    render(
      <ActiveCampusAdmissionGate cohortId="c-1">
        <p>Active campus</p>
      </ActiveCampusAdmissionGate>,
    );

    expect(screen.getByText("Active campus")).toBeVisible();
    expect(window.location.pathname + window.location.search).toBe(
      "/campus/c-1/meeting?tab=people",
    );
    expect(window.history.state).toEqual({ retained: true });
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("does not admit an invalid marker", () => {
    navigation.searchParams = new URLSearchParams("prejoin=pending");

    expect(() =>
      render(
        <ActiveCampusAdmissionGate cohortId="c-1">
          <p>Active campus</p>
        </ActiveCampusAdmissionGate>,
      ),
    ).toThrowError(
      "NEXT_REDIRECT:/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting",
    );
  });
});
