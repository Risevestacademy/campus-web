import { act, fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { StrictMode } from "react";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { inOrder, type Reply, TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import { RefreshSession } from "../index";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("server-only", () => ({}));

const DESTINATION = "/campus/42/rooms?seat=3";
const REFRESH_URL = `${TEST_ORIGIN}/api/v1/auth/refresh`;

const refreshed: Reply = () =>
  Response.json({
    expiresAt: "2026-10-02T12:15:00.000Z",
    refreshExpiresAt: "2026-11-01T12:00:00.000Z",
  });
const status =
  (code: number, headers?: HeadersInit): Reply =>
  () =>
    new Response(null, { status: code, headers });
const networkFailure: Reply = () => HttpResponse.error();

function refreshReplies(...replies: Reply[]) {
  mockApi.server.use(http.post(REFRESH_URL, inOrder(...replies)));
}

function renderRefresh() {
  return render(
    <StrictMode>
      {withQueryClient(<RefreshSession returnTo={DESTINATION} />)}
    </StrictMode>,
  );
}

async function elapse(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function clickRetry() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  });
  await elapse();
}

const retryButton = () => screen.getByRole("button", { name: "Try again" });
const refreshPosts = () =>
  mockApi.requests.filter(
    (request) => request.method === "POST" && request.url === REFRESH_URL,
  );

beforeEach(() => {
  vi.useFakeTimers();
  navigation.replace.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("RefreshSession: automatic refresh", () => {
  it("tells the visitor their session is being restored", () => {
    refreshReplies(refreshed);
    renderRefresh();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Restoring your session",
    );
  });

  it("sends exactly one refresh request, even when React mounts twice", async () => {
    refreshReplies(refreshed);
    renderRefresh();
    await elapse();

    expect(
      mockApi.requests.map(({ method, url }) => ({ method, url })),
    ).toEqual([{ method: "POST", url: REFRESH_URL }]);
  });

  it("returns to the destination, replacing the refresh page in history", async () => {
    refreshReplies(refreshed);
    renderRefresh();
    await elapse();

    expect(navigation.replace.mock.calls).toEqual([[DESTINATION]]);
  });

  // The refresh API answers 401 alike for a visitor who never signed in, so
  // sign-in must not claim a session expired.
  it("sends a rejected refresh to plain sign-in with the destination", async () => {
    refreshReplies(status(401));
    renderRefresh();
    await elapse();

    expect(navigation.replace.mock.calls).toEqual([
      ["/sign-in?returnTo=%2Fcampus%2F42%2Frooms%3Fseat%3D3"],
    ]);
  });
});

describe("RefreshSession: failed refresh", () => {
  it.each([
    ["a network failure", networkFailure],
    ["HTTP 408", status(408)],
    ["HTTP 429", status(429)],
    ["HTTP 500", status(500)],
    ["HTTP 503", status(503)],
    ["an unexpected HTTP 400", status(400)],
  ])(
    "fails closed on %s and never replays the refresh by itself",
    async (_, reply) => {
      refreshReplies(reply);
      renderRefresh();
      await elapse(60_000);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "We couldn't restore your session",
      );
      expect(refreshPosts()).toHaveLength(1);
      expect(navigation.replace).not.toHaveBeenCalled();
    },
  );

  it("unlocks the retry control after one second", async () => {
    refreshReplies(status(503));
    renderRefresh();
    await elapse();
    await elapse(999);

    expect(retryButton()).toBeDisabled();

    await elapse(1);

    expect(retryButton()).toBeEnabled();
  });

  it("lengthens the cooldown after each failed retry to 2, 4, 8, then 8 seconds", async () => {
    refreshReplies(
      status(503),
      status(503),
      status(503),
      status(503),
      status(503),
    );
    renderRefresh();
    await elapse();
    await elapse(1000);

    for (const cooldownMs of [2000, 4000, 8000, 8000]) {
      await clickRetry();
      await elapse(cooldownMs - 1);
      expect(retryButton()).toBeDisabled();

      await elapse(1);
      expect(retryButton()).toBeEnabled();
    }

    expect(refreshPosts()).toHaveLength(5);
  });

  it.each([
    ["a longer Retry-After extends the cooldown", "5", 5000],
    ["Retry-After is capped at eight seconds", "30", 8000],
  ])("%s", async (_, retryAfter, cooldownMs) => {
    refreshReplies(status(429, { "retry-after": retryAfter }));
    renderRefresh();
    await elapse();
    await elapse(cooldownMs - 1);

    expect(retryButton()).toBeDisabled();

    await elapse(1);

    expect(retryButton()).toBeEnabled();
  });

  it("counts down the seconds until the next attempt", async () => {
    refreshReplies(status(429, { "retry-after": "3" }));
    renderRefresh();
    await elapse();

    expect(screen.getByText("You can try again in 3 seconds.")).toBeVisible();

    await elapse(1000);

    expect(screen.getByText("You can try again in 2 seconds.")).toBeVisible();
  });

  it("returns to the destination when a manual retry succeeds", async () => {
    refreshReplies(status(503), refreshed);
    renderRefresh();
    await elapse();
    await elapse(1000);

    await clickRetry();

    expect(refreshPosts()).toHaveLength(2);
    expect(navigation.replace.mock.calls).toEqual([[DESTINATION]]);
  });
});
