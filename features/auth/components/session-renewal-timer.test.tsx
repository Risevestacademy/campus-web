import { act, fireEvent, render, screen } from "@testing-library/react";
import { http } from "msw";
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

import { toast, Toaster } from "@/shared/ui/toast";
import { inOrder, type Reply, TEST_ORIGIN } from "@/tests/fixtures/mock-api";

import { SessionRenewalTimer } from "./session-renewal-timer";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const sideEffects = vi.hoisted(() => [] as string[]);

vi.mock("@/core/analytics/client", () => ({
  captureBrowserAnalyticsEvent: (name: string, properties: object) => {
    sideEffects.push(`capture ${name} ${JSON.stringify(properties)}`);
  },
  resetAnalyticsUser: () => {
    sideEffects.push("reset analytics user");
  },
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => {
    sideEffects.push(`replace document ${href}`);
  },
}));

const REFRESH_URL = `${TEST_ORIGIN}/api/v1/auth/refresh`;
const NOW = Date.parse("2026-10-14T12:00:00.000Z");
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;

function at(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

const refreshedUntil =
  (expiresAt: string): Reply =>
  () =>
    Response.json({
      expiresAt,
      refreshExpiresAt: at(30 * DAY),
    });

const status =
  (code: number, headers?: HeadersInit): Reply =>
  () =>
    new Response(null, { status: code, headers });

function refreshReplies(...replies: Reply[]) {
  mockApi.server.use(http.post(REFRESH_URL, inOrder(...replies)));
}

function renderRenewal(expiresAt: string) {
  return render(
    <>
      <SessionRenewalTimer expiresAt={expiresAt} />
      <Toaster />
    </>,
  );
}

async function elapse(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const refreshPosts = () =>
  mockApi.requests.filter(
    (request) => request.method === "POST" && request.url === REFRESH_URL,
  );

const refreshOffsets = () => refreshPosts().map(({ sentAt }) => sentAt - NOW);

const renewalEvents = () =>
  sideEffects.filter((effect) =>
    effect.startsWith("capture auth.session_renewed"),
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  sideEffects.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("SessionRenewalTimer: timing", () => {
  it("renews two minutes before a 15-minute token lapses", async () => {
    refreshReplies(refreshedUntil(at(28 * MINUTE)));
    renderRenewal(at(15 * MINUTE));

    await elapse(13 * MINUTE - 1);
    expect(refreshPosts()).toHaveLength(0);

    await elapse(1);
    expect(refreshPosts()).toHaveLength(1);
  });

  it("schedules the next renewal from the renewed token's expiry", async () => {
    refreshReplies(
      refreshedUntil(at(28 * MINUTE)),
      refreshedUntil(at(41 * MINUTE)),
    );
    renderRenewal(at(15 * MINUTE));

    await elapse(26 * MINUTE - 1);
    expect(refreshPosts()).toHaveLength(1);

    await elapse(1);
    expect(refreshPosts()).toHaveLength(2);
  });

  it("renews a short-lived token at three quarters of its remaining life", async () => {
    refreshReplies(refreshedUntil(at(30 * MINUTE)));
    renderRenewal(at(8 * SECOND));

    await elapse(6 * SECOND - 1);
    expect(refreshPosts()).toHaveLength(0);

    await elapse(1);
    expect(refreshPosts()).toHaveLength(1);
  });

  // Browsers fire a setTimeout longer than 2^31-1 ms (~24.8 days) at once.
  it("never renews a far-future expiry early", async () => {
    renderRenewal("2099-01-01T00:15:00.000Z");

    await elapse(30 * DAY);

    expect(refreshPosts()).toHaveLength(0);
  });
});

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
}

const wakeSignals: [string, () => void][] = [
  [
    "becomes visible",
    () => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    },
  ],
  ["regains focus", () => window.dispatchEvent(new Event("focus"))],
  ["comes back online", () => window.dispatchEvent(new Event("online"))],
  [
    "is restored from the back-forward cache",
    () => window.dispatchEvent(new Event("pageshow")),
  ],
];

// A sleeping device or frozen tab moves the clock without firing timers.
function sleepUntil(offsetMs: number) {
  vi.setSystemTime(NOW + offsetMs);
}

async function wake(signal: () => void) {
  await act(async () => {
    signal();
  });
  await elapse();
}

describe("SessionRenewalTimer: waking", () => {
  afterEach(() => {
    setVisibility("visible");
  });

  it.each(wakeSignals)(
    "renews at once when the page %s after the renewal fell due",
    async (_, signal) => {
      refreshReplies(refreshedUntil(at(30 * MINUTE)));
      renderRenewal(at(15 * MINUTE));

      sleepUntil(14 * MINUTE);
      await wake(signal);

      expect(refreshPosts()).toHaveLength(1);
    },
  );

  it.each(wakeSignals)(
    "sends nothing when the page %s before the renewal is due",
    async (_, signal) => {
      renderRenewal(at(15 * MINUTE));

      sleepUntil(12 * MINUTE);
      await wake(signal);

      expect(refreshPosts()).toHaveLength(0);
    },
  );

  it("ignores a visibility change to hidden", async () => {
    renderRenewal(at(15 * MINUTE));

    sleepUntil(14 * MINUTE);
    setVisibility("hidden");
    await wake(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(refreshPosts()).toHaveLength(0);
  });
});

describe("SessionRenewalTimer: failed renewal", () => {
  it("retries after 1, 2, 4, then 8 seconds", async () => {
    refreshReplies(
      status(503),
      status(503),
      status(503),
      status(503),
      status(503),
      refreshedUntil(at(30 * MINUTE)),
    );
    renderRenewal(at(15 * MINUTE));

    await elapse(14 * MINUTE);

    expect(refreshOffsets()).toEqual([
      13 * MINUTE,
      13 * MINUTE + 1 * SECOND,
      13 * MINUTE + 3 * SECOND,
      13 * MINUTE + 7 * SECOND,
      13 * MINUTE + 15 * SECOND,
      13 * MINUTE + 23 * SECOND,
    ]);
  });

  it("waits as long as Retry-After asks, up to the longest cooldown", async () => {
    refreshReplies(
      status(429, { "retry-after": "5" }),
      status(503, { "retry-after": "120" }),
      refreshedUntil(at(30 * MINUTE)),
    );
    renderRenewal(at(15 * MINUTE));

    await elapse(14 * MINUTE);

    expect(refreshOffsets()).toEqual([
      13 * MINUTE,
      13 * MINUTE + 5 * SECOND,
      13 * MINUTE + 13 * SECOND,
    ]);
  });

  it("counts a renewal once when the page wakes while it is in flight", async () => {
    let answer: (() => void) | undefined;
    refreshReplies(
      async () => {
        await new Promise<void>((resolve) => {
          answer = resolve;
        });
        return status(503)();
      },
      refreshedUntil(at(30 * MINUTE)),
    );
    renderRenewal(at(15 * MINUTE));
    await elapse(13 * MINUTE);

    await wake(() => window.dispatchEvent(new Event("focus")));
    answer?.();
    await elapse(14 * MINUTE);

    expect(refreshOffsets()).toEqual([13 * MINUTE, 13 * MINUTE + 1 * SECOND]);
  });

  it("stops retrying when the token lapses, then retries when the page wakes", async () => {
    refreshReplies(
      status(503),
      status(503),
      status(503),
      refreshedUntil(at(30 * MINUTE)),
    );
    renderRenewal(at(8 * SECOND));

    await elapse(MINUTE);
    expect(refreshOffsets()).toEqual([6 * SECOND, 7 * SECOND]);

    await wake(() => window.dispatchEvent(new Event("online")));
    await wake(() => window.dispatchEvent(new Event("focus")));

    expect(refreshPosts()).toHaveLength(4);
    expect(renewalEvents()).toEqual([
      'capture auth.session_renewed {"outcome":"lapsed","failed_attempts":2}',
      'capture auth.session_renewed {"outcome":"renewed","failed_attempts":3}',
    ]);
    expect(sideEffects).not.toContain("reset analytics user");
  });

  it("records a renewal and the failed attempts before it", async () => {
    refreshReplies(status(503), refreshedUntil(at(30 * MINUTE)));
    renderRenewal(at(15 * MINUTE));

    await elapse(14 * MINUTE);

    expect(renewalEvents()).toEqual([
      'capture auth.session_renewed {"outcome":"renewed","failed_attempts":1}',
    ]);
  });
});

describe("SessionRenewalTimer: ended session", () => {
  const COHORT_PAGE = "/campus/c-3/overview?tab=people";

  beforeEach(() => {
    window.history.replaceState(null, "", COHORT_PAGE);
    refreshReplies(status(401));
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  it("stops renewing and keeps the page", async () => {
    renderRenewal(at(15 * MINUTE));

    await elapse(13 * MINUTE);
    await wake(() => window.dispatchEvent(new Event("online")));
    await elapse(30 * MINUTE);

    expect(refreshPosts()).toHaveLength(1);
    expect(sideEffects).not.toContainEqual(
      expect.stringMatching(/^replace document/),
    );
    expect(renewalEvents()).toEqual([
      'capture auth.session_renewed {"outcome":"expired","failed_attempts":0}',
    ]);
  });

  it("forgets the member's analytics identity before announcing the end", async () => {
    vi.spyOn(toast, "add").mockImplementation(() => {
      sideEffects.push("announce session ended");
      return "session-ended";
    });
    renderRenewal(at(15 * MINUTE));

    await elapse(13 * MINUTE);

    expect(
      sideEffects.filter((effect) => !effect.startsWith("capture")),
    ).toEqual(["reset analytics user", "announce session ended"]);
  });

  it("offers sign-in, returning to the same page", async () => {
    renderRenewal(at(15 * MINUTE));
    await elapse(13 * MINUTE);

    expect(
      screen.getByRole("heading", { name: "Your session ended" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(sideEffects).toContain(
      "replace document /sign-in?returnTo=%2Fcampus%2Fc-3%2Foverview%3Ftab%3Dpeople",
    );
  });
});

const SHARED_EXPIRY_KEY = "campus.session-expires-at";
const FAR_FUTURE = Date.parse("2099-01-01T00:00:00.000Z");

function stubWebLocks() {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (name: string, task: () => Promise<unknown>) => {
        sideEffects.push(`acquire ${name}`);
        const result = await task();
        sideEffects.push(`release ${name}`);
        return result;
      },
    },
  });
}

describe("SessionRenewalTimer: other tabs", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "locks");
  });

  it("follows another tab's renewal instead of renewing at the old time", async () => {
    refreshReplies(refreshedUntil(at(35 * MINUTE)));
    renderRenewal(at(15 * MINUTE));
    await elapse(5 * MINUTE);

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: SHARED_EXPIRY_KEY,
          newValue: String(NOW + 20 * MINUTE),
        }),
      );
    });
    await elapse(13 * MINUTE - 1);
    expect(refreshPosts()).toHaveLength(0);

    await elapse(1);
    expect(refreshOffsets()).toEqual([18 * MINUTE]);
  });

  // A frozen tab misses the storage event but still reads storage when it runs.
  it("skips the request when another tab already renewed by the time it is due", async () => {
    refreshReplies(refreshedUntil(at(45 * MINUTE)));
    renderRenewal(at(15 * MINUTE));
    await elapse(12 * MINUTE);

    localStorage.setItem(SHARED_EXPIRY_KEY, String(NOW + 28 * MINUTE));
    await elapse(14 * MINUTE);

    expect(refreshOffsets()).toEqual([26 * MINUTE]);
  });

  it("renews inside the origin-wide session lock", async () => {
    stubWebLocks();
    mockApi.server.use(
      http.post(REFRESH_URL, () => {
        sideEffects.push("POST refresh");
        return refreshedUntil(at(28 * MINUTE))();
      }),
    );
    renderRenewal(at(15 * MINUTE));

    await elapse(13 * MINUTE);

    expect(
      sideEffects.filter((effect) => !effect.startsWith("capture")),
    ).toEqual([
      "acquire campus-session-renewal",
      "POST refresh",
      "release campus-session-renewal",
    ]);
  });

  it("shares the renewed expiry with other tabs", async () => {
    refreshReplies(refreshedUntil(at(28 * MINUTE)));
    renderRenewal(at(15 * MINUTE));

    await elapse(13 * MINUTE);

    expect(localStorage.getItem(SHARED_EXPIRY_KEY)).toBe(
      String(NOW + 28 * MINUTE),
    );
  });

  it("ignores a stored expiry further ahead than an access token lives", async () => {
    localStorage.setItem(SHARED_EXPIRY_KEY, String(FAR_FUTURE));
    refreshReplies(refreshedUntil(at(28 * MINUTE)));
    renderRenewal(at(15 * MINUTE));

    await elapse(14 * MINUTE);

    expect(refreshOffsets()).toEqual([13 * MINUTE]);
  });

  it("still renews when a far-future expiry appears in storage before it is due", async () => {
    refreshReplies(refreshedUntil(at(28 * MINUTE)));
    renderRenewal(at(15 * MINUTE));
    await elapse(12 * MINUTE);

    localStorage.setItem(SHARED_EXPIRY_KEY, String(FAR_FUTURE));
    await elapse(2 * MINUTE);

    expect(refreshOffsets()).toEqual([13 * MINUTE]);
  });

  it("starts from a later expiry another tab already shared", async () => {
    localStorage.setItem(SHARED_EXPIRY_KEY, String(NOW + 14 * MINUTE));
    refreshReplies(refreshedUntil(at(26 * MINUTE)));
    renderRenewal(at(5 * MINUTE));

    await elapse(13 * MINUTE);

    expect(refreshOffsets()).toEqual([12 * MINUTE]);
  });
});

describe("SessionRenewalTimer: lifecycle", () => {
  it("stops renewing once the cohort pages unmount", async () => {
    const view = renderRenewal(at(15 * MINUTE));
    view.unmount();

    await elapse(13 * MINUTE);
    await wake(() => window.dispatchEvent(new Event("online")));
    await elapse(30 * MINUTE);

    expect(refreshPosts()).toHaveLength(0);
  });

  it("sends one request when React mounts twice", async () => {
    refreshReplies(refreshedUntil(at(28 * MINUTE)));
    render(
      <StrictMode>
        <SessionRenewalTimer expiresAt={at(15 * MINUTE)} />
      </StrictMode>,
    );

    await elapse(14 * MINUTE);

    expect(refreshOffsets()).toEqual([13 * MINUTE]);
  });

  it("restarts from a later seed instead of keeping the old schedule", async () => {
    refreshReplies(refreshedUntil(at(55 * MINUTE)));
    const view = render(
      <SessionRenewalTimer key="first" expiresAt={at(15 * MINUTE)} />,
    );
    await elapse(5 * MINUTE);

    view.rerender(
      <SessionRenewalTimer key="second" expiresAt={at(40 * MINUTE)} />,
    );
    await elapse(35 * MINUTE);

    expect(refreshOffsets()).toEqual([38 * MINUTE]);
  });
});
