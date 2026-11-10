import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RoomLinkPage from "./page";

const CODE = "k3F9xQ2pLm";

const routeAccess = vi.hoisted(() => ({ requireRouteAccess: vi.fn() }));
const entering = vi.hoisted(() => ({ enterRoomLink: vi.fn() }));
const navigation = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT ${href}`);
  }),
}));

vi.mock("next/navigation", () => navigation);
vi.mock("@/core/api/client/server", () => ({
  getServerApi: () => Promise.resolve({ marker: "server-api" }),
}));
vi.mock("@/features/auth", () => ({
  requireRouteAccess: routeAccess.requireRouteAccess,
  SessionUnavailable: ({ retryHref }: { retryHref: string }) => (
    <p>Session unavailable {retryHref}</p>
  ),
}));
vi.mock("@/features/room-link", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/room-link")>()),
  enterRoomLink: entering.enterRoomLink,
}));
vi.mock("server-only", () => ({}));

const params = (code: string) => Promise.resolve({ code });

beforeEach(() => {
  routeAccess.requireRouteAccess.mockResolvedValue({
    kind: "allow",
    session: {},
  });
});

afterEach(() => {
  routeAccess.requireRouteAccess.mockReset();
  entering.enterRoomLink.mockReset();
  navigation.redirect.mockClear();
  navigation.notFound.mockClear();
});

describe("RoomLinkPage", () => {
  it("sends the member through the link's cohort pre-join, asking for the space", async () => {
    entering.enterRoomLink.mockResolvedValue({
      kind: "entered",
      cohortId: "cohort-3",
      spaceKey: "library",
    });

    await expect(RoomLinkPage({ params: params(CODE) })).rejects.toThrow(
      `NEXT_REDIRECT /campus/cohort-3/join?returnTo=${encodeURIComponent(
        "/campus/cohort-3?goToSpace=library",
      )}`,
    );
    expect(routeAccess.requireRouteAccess).toHaveBeenCalledWith({
      kind: "room-link",
    });
    expect(entering.enterRoomLink).toHaveBeenCalledExactlyOnceWith(
      { marker: "server-api" },
      CODE,
    );
  });

  it("encodes a space key that is not a plain word", async () => {
    entering.enterRoomLink.mockResolvedValue({
      kind: "entered",
      cohortId: "cohort-3",
      spaceKey: "pod a&b",
    });

    await expect(RoomLinkPage({ params: params(CODE) })).rejects.toThrow(
      encodeURIComponent("goToSpace=pod+a%26b"),
    );
  });

  it("says the link does not work, without saying why", async () => {
    entering.enterRoomLink.mockResolvedValue({ kind: "unusable" });

    render(await RoomLinkPage({ params: params(CODE) }));

    expect(
      screen.getByRole("heading", { name: "This link doesn't work" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to Campus" })).toHaveAttribute(
      "href",
      "/campus",
    );
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("offers a retry of the same link when campus-api is down", async () => {
    entering.enterRoomLink.mockResolvedValue({ kind: "unavailable" });

    render(await RoomLinkPage({ params: params(CODE) }));

    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      `/join/${CODE}`,
    );
  });

  it("shows the session retry when the session cannot be read", async () => {
    routeAccess.requireRouteAccess.mockResolvedValue({
      kind: "unavailable",
      retryHref: `/join/${CODE}`,
    });

    render(await RoomLinkPage({ params: params(CODE) }));

    expect(screen.getByText(`Session unavailable /join/${CODE}`)).toBeVisible();
    expect(entering.enterRoomLink).not.toHaveBeenCalled();
  });

  it.each(["short", "waytoolongforacode", "has-a-dash", "..%2Fcampus"])(
    "answers 404 for %s without asking campus-api",
    async (code) => {
      await expect(RoomLinkPage({ params: params(code) })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );

      expect(routeAccess.requireRouteAccess).not.toHaveBeenCalled();
      expect(entering.enterRoomLink).not.toHaveBeenCalled();
    },
  );
});
