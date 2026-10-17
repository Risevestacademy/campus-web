// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { allowAnalyticsProperties } from "@/core/analytics/events";
import { createPresenceStore } from "@/core/presence";
import type { RealtimeOutcome } from "@/core/realtime";
import { createAdmissionStore } from "@/features/campus/services/presence-session/admission-store";
import { followWorldOutcome } from "@/features/campus/services/presence-session/follow-world-outcome";
import type { AnalyticsCapture } from "@/features/campus/services/world-session/realtime-analytics";
import { createWorldSession } from "@/features/campus/services/world-session/world-session";
import { createCountingMediaSession } from "@/features/campus/testing/presence-tab-test-utils";
import {
  admit,
  closeWith,
  type MockConnection,
  startMockWorld,
  WORLD_SOCKET_URL,
} from "@/tests/fixtures/mock-world";

const { closeAfterTest, serveWorld } = startMockWorld();

const TEN_MINUTES_MS = 10 * 60_000;
const PAGE_MOUNTS = 20;
const MARKER = "close-reason-must-not-leave";

// The Presence Session as PresenceSessionProvider composes it, admitted.
async function joinedSession(
  world: (connection: MockConnection) => void,
  refreshSession = async () => true,
) {
  vi.useFakeTimers();
  const sockets = serveWorld(world);
  const media = createCountingMediaSession();
  const admission = createAdmissionStore();
  admission.getState().grantEntry("/campus/cohort-1");
  admission.getState().completeEntry("/campus/cohort-1");
  await media.store.getState().start();
  media.store.getState().connect("cohort-1");
  const replaceDocument = vi.fn<(href: string) => void>();
  const followOutcome = followWorldOutcome(media.store, admission, {
    currentHref: () => "https://campus.example.test/campus/cohort-1",
    replaceDocument,
  });
  const outcomes: RealtimeOutcome[] = [];
  const captures: AnalyticsCapture[] = [];
  const session = closeAfterTest(
    createWorldSession({
      url: WORLD_SOCKET_URL,
      cohortId: "cohort-1",
      presence: createPresenceStore(),
      refreshSession,
      captureEvent: (capture) => captures.push(capture),
      onOutcome(outcome) {
        outcomes.push(outcome);
        followOutcome(outcome);
      },
      createSocket: (url) => new WebSocket(url),
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
      random: () => 0,
    }),
  );

  return {
    admission,
    captures,
    media,
    outcomes,
    replaceDocument,
    session,
    sockets,
  };
}

// Every cohort page mounting PresenceSessionGate calls connect().
async function browseCohortPages(session: { connect(): void }) {
  for (let mount = 0; mount < PAGE_MOUNTS; mount += 1) {
    session.connect();
    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS / PAGE_MOUNTS);
  }
}

describe("realtime session eval (threshold: every case holds)", () => {
  it.each(["entered_elsewhere", "", MARKER.repeat(100)])(
    "after 4000 %#, ends the call in place and opens no socket for ten minutes of browsing",
    async (reason) => {
      const { admission, media, outcomes, replaceDocument, session, sockets } =
        await joinedSession(closeWith(4000, reason));

      session.connect();
      await browseCohortPages(session);

      expect(sockets.connections).toHaveLength(1);
      expect(outcomes).toEqual(["entered-elsewhere"]);
      expect(session.getStatus()).toEqual({
        phase: "closed",
        outcome: "entered-elsewhere",
      });
      expect(media.liveConnections()).toBe(0);
      expect(admission.getState().admitted).toBe(false);
      expect(replaceDocument).not.toHaveBeenCalled();
    },
  );

  it.each<[string, number, string, RealtimeOutcome]>([
    ["no session", 1008, "no_token", "sign-in"],
    ["a revoked session", 1008, "session_revoked", "sign-in"],
    ["onboarding", 1008, "wrong_scope", "onboarding"],
    ["a suspension", 1008, "account_suspended", "sign-out"],
    ["a removed account", 1008, "account_gone", "sign-out"],
    ["a removed membership", 1008, "not_a_member", "choose-cohort"],
    ["a refused origin", 1008, "origin_not_allowed", "stop"],
    ["no cohort", 1008, "no_cohort", "stop"],
    ["a refusal it does not know", 1008, MARKER, "stop"],
    ["another device", 4000, "entered_elsewhere", "entered-elsewhere"],
    ["a world that never stays up", 1006, "", "gave-up"],
  ])(
    "hands %s to the Presence Session exactly once",
    async (_, code, reason, outcome) => {
      const { outcomes, session } = await joinedSession(
        closeWith(code, reason),
      );

      session.connect();
      await browseCohortPages(session);

      expect(outcomes).toEqual([outcome]);
    },
  );

  it("hands a session world keeps ending to sign-in once, after one refresh", async () => {
    const refreshSession = vi.fn(async () => false);
    const { outcomes, replaceDocument, session } = await joinedSession(
      closeWith(1008, "session_ended"),
      refreshSession,
    );

    session.connect();
    await browseCohortPages(session);

    expect(refreshSession).toHaveBeenCalledOnce();
    expect(outcomes).toEqual(["sign-in"]);
    expect(replaceDocument).toHaveBeenCalledOnce();
  });

  it.each<[number, string]>([
    [1008, ""],
    [1008, MARKER],
    [1008, "ada@campus.local"],
    [1008, "constructor"],
    [1008, "__proto__"],
    [1008, " no_token"],
    [1008, "NO_TOKEN"],
    [1011, MARKER.repeat(1_000)],
    [4000, "https://campus.example.test/?token=secret"],
  ])(
    "reports %i %# to analytics only as a known reason or unknown",
    async (code, reason) => {
      const { captures, session } = await joinedSession(
        closeWith(code, reason),
      );

      session.connect();
      await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);

      const closes = captures.filter(([name]) => name === "realtime.closed");
      expect(closes.length).toBeGreaterThan(0);
      for (const [name, properties] of closes) {
        expect(properties).toMatchObject({ reason: "unknown" });
        expect(allowAnalyticsProperties(name, properties)).toEqual(properties);
      }
      expect(JSON.stringify(captures)).not.toContain(MARKER);
    },
  );

  it("passes every capture through the analytics allow-list unchanged", async () => {
    let socket = 0;
    const { captures, session } = await joinedSession((connection) => {
      admit(connection);
      if ((socket += 1) < 4)
        connection.client.close(1001, "server shutting down");
    });

    session.connect();
    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);

    expect(captures.map(([name]) => name)).toContain("realtime.reconnected");
    for (const [name, properties] of captures) {
      expect(allowAnalyticsProperties(name, properties)).toEqual(properties);
    }
  });
});
