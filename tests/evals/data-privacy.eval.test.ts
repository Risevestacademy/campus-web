// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { validateBuildEnvironment } from "@/config/environment/validation";
import {
  analyticsCohortSchema,
  analyticsEventSchemas,
  analyticsIdentitySchema,
} from "@/core/analytics/events";
import { scrubAnalyticsEvent } from "@/core/analytics/scrub";
import {
  parseServerMessage,
  parseSocketClose,
  type ServerMessage,
} from "@/core/realtime";
import { readWorldOrigin } from "@/core/realtime/configuration";
import {
  parseFeedbackList,
  parseFeedbackRecord,
} from "@/features/admin/feedback/schemas/feedback.schema";
import { parseReturnTo } from "@/features/auth/schemas/return-to";
import { parseSessionBody } from "@/features/auth/schemas/session.schema";
import { checkConnection } from "@/features/campus/services/connection-check/check-connection";
import {
  type ConnectionCheckAccess,
  requestConnectionCheck,
} from "@/features/campus/services/connection-check/connection-check.service";
import { loadLivekitProbe } from "@/features/campus/services/connection-check/livekit-probe";
import { runConnectionCheck } from "@/features/campus/services/connection-check/run-connection-check";
import { fakeLivekit, fakeTrack } from "@/features/campus/testing/fake-livekit";
import { parseFeedbackReceipt } from "@/features/feedback/schemas/feedback.schema";
import {
  parseInvitePreview,
  parsePendingInvite,
} from "@/features/invitation/schemas/invite.schema";
import { moveInviteTokenToCookie } from "@/features/invitation/services/invite-token-proxy.service";
import { invitePreview, pendingInvite } from "@/tests/fixtures/invites";
import { serverFrames } from "@/tests/fixtures/world-frames";

vi.mock("server-only", () => ({}));

// A new field reaching screens or PostHog fails here until it is added to an
// allow-list below, on purpose: each addition is a privacy decision.

const TOKEN = "zHrjwba-bzFiiuyT5wb1OiuUQUdS619_DNNd0C6sFg0";
const ORIGIN = "https://campus.example";
const UNEXPECTED = { phone: "+2348000000000", internalNote: "do not ship" };
function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return keyPaths(value[0], `${prefix}[]`);
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value)
    .flatMap(([key, child]) =>
      keyPaths(child, prefix ? `${prefix}.${key}` : key),
    )
    .sort();
}

const person = { id: "u-1", email: "ada@campus.local", displayName: "Ada" };
const FEEDBACK_SUMMARY = {
  id: "f-1",
  type: "report",
  title: "Rude in chat",
  about: "Ana | Hall",
  status: "open",
  createdAt: "2026-10-16T12:00:00.000Z",
  submittedBy: person,
  reportedUser: person,
};
const FEEDBACK_SUMMARY_ALLOW_LIST = [
  "about",
  "createdAt",
  "id",
  "reportedUser.displayName",
  "reportedUser.email",
  "reportedUser.id",
  "status",
  "submittedBy.displayName",
  "submittedBy.email",
  "submittedBy.id",
  "title",
  "type",
].sort();
const FEEDBACK_RECORD_ALLOW_LIST = [
  ...FEEDBACK_SUMMARY_ALLOW_LIST,
  "context.path",
  "details",
  "resolvedAt",
  "resolvedBy",
].sort();

const SESSION_ALLOW_LIST = [
  "expiresAt",
  "inviteId",
  "memberships[].cohort.code",
  "memberships[].cohort.name",
  "memberships[].cohortId",
  "memberships[].role",
  "scope",
  "user.displayName",
  "user.email",
  "user.id",
  "user.systemRole",
];

const INVITE_PREVIEW_ALLOW_LIST = [
  "cohort.name",
  "cohortRole",
  "invitedBy.firstName",
  "invitedBy.lastName",
  "systemRole",
  "track.name",
];

const PENDING_INVITE_ALLOW_LIST = [
  "cohort.name",
  "cohortRole",
  "id",
  "systemRole",
  "track.name",
  "user.displayName",
  "user.email",
  "user.firstName",
  "user.lastName",
];

const ANALYTICS_ALLOW_LIST: Record<string, string[]> = {
  "auth.login_failed": ["auth_method", "error_code"],
  "auth.login_submitted": ["auth_method", "entry_source", "platform"],
  "auth.login_succeeded": [
    "account_status",
    "auth_method",
    "cohort_id",
    "role",
    "track_id",
    "user_id",
  ],
  "auth.logout": ["logout_source"],
  "auth.password_reset_completed": [],
  "auth.password_reset_requested": ["reset_method"],
  "auth.session_renewed": ["failed_attempts", "outcome"],
  "auth.signup_failed": ["auth_method", "error_code"],
  "auth.signup_submitted": ["auth_method", "platform"],
  "auth.signup_succeeded": ["auth_method", "role", "user_id"],
  "auth.verification_completed": ["verification_type"],
  "auth.verification_sent": ["verification_type"],
  "campus.connection_check_completed": ["failed_step", "result"],
  "campus.presence_tab_conflict_shown": ["surface"],
  "campus.presence_tab_moved": ["surface"],
  "campus_world.camera_zoomed": ["level"],
  "campus_world.map_failed": ["error_kind", "map_id"],
  "campus_world.map_loaded": ["load_ms", "map_id", "tilesets", "version"],
  "campus_world.map_ready": ["first_frame_ms", "map_id", "version"],
  "campus_world.move_corrected": ["outcome"],
  "cohort.created": ["cohort_status"],
  "identity.profile_setup_completed": ["cohort_id", "role", "track_id"],
  "identity.profile_setup_started": ["cohort_id", "role", "track_id"],
  "realtime.closed": ["action", "code", "reason"],
  "realtime.connected": ["reconnect"],
  "realtime.gave_up": ["attempts"],
  "realtime.reconnected": ["attempts"],
};

// The person carries the identity; each event in a cohort carries the cohort.
const ANALYTICS_MEMBER_ALLOW_LIST = {
  identity: ["id", "systemRole"],
  cohort: ["cohortId", "cohortRole"],
};
const analyticsMemberSchemas = [
  ["identity", analyticsIdentitySchema],
  ["cohort", analyticsCohortSchema],
] as const;

const PLAYER_PATHS = ["facing", "userId", "x", "y"];
const AVATAR_PATHS = [...PLAYER_PATHS, "displayName", "spriteKey"].sort();

function under(prefix: string, paths: string[]): string[] {
  return paths.map((path) => `${prefix}.${path}`);
}

const WORLD_FRAME_ALLOW_LIST: Record<ServerMessage["type"], string[]> = {
  appearance: ["displayName", "spriteKey", "type", "userId"],
  call: ["type"],
  error: ["code", "message", "type"],
  joined: [...under("player", AVATAR_PATHS), "type"],
  left: ["type", "userId"],
  lockChanged: ["type"],
  lockableSpaces: ["type"],
  moveResult: ["outcome", ...under("player", PLAYER_PATHS), "seq", "type"],
  moved: [...under("players[]", PLAYER_PATHS), "type"],
  nearby: ["type", "userIds[]"],
  pong: ["type"],
  replaced: ["type"],
  spaceChanged: ["type"],
  statusChanged: ["type"],
  snapshot: [
    ...under("map", ["height", "id", "version", "width"]),
    ...under("players[]", AVATAR_PATHS),
    "type",
  ],
  welcome: [
    "connectionId",
    "displayName",
    "heartbeatSeconds",
    "spriteKey",
    "stepMs",
    "tickMs",
    "type",
    "userId",
  ],
};

function withUnexpectedFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withUnexpectedFields);
  if (value === null || typeof value !== "object") return value;
  return {
    ...Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        withUnexpectedFields(child),
      ]),
    ),
    ...UNEXPECTED,
  };
}

async function completeGoogleSignIn(
  backendDestination: string,
  ...upstreamSetCookies: string[]
) {
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.stubGlobal("fetch", () => {
    const headers = new Headers({
      location: `${ORIGIN}${backendDestination}`,
    });
    for (const setCookie of upstreamSetCookies) {
      headers.append("set-cookie", setCookie);
    }
    return Promise.resolve(new Response(null, { headers, status: 302 }));
  });
  const { GET } = await import("@/app/api/[...path]/route");

  const response = await GET(
    new Request(`${ORIGIN}/api/v1/auth/google/callback?code=google-code`),
    { params: Promise.resolve({ path: ["v1", "auth", "google", "callback"] }) },
  );

  return response.headers
    .getSetCookie()
    .filter((setCookie) => setCookie.startsWith("campus_invite_token="));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const eventSchemas: [string, z.ZodObject][] = Object.entries(
  analyticsEventSchemas,
);

const sessionDto = {
  scope: "full_access",
  expiresAt: "2026-10-02T12:15:00.000Z",
  inviteId: "66666666-6666-4666-8666-666666666666",
  user: {
    id: "55555555-5555-4555-8555-555555555555",
    email: "ada@campus.local",
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: "Ada Lovelace",
    avatarUrl: "https://lh3.googleusercontent.com/a/example",
    systemRole: "user",
    ...UNEXPECTED,
  },
  membership: { cohortId: "c-1", role: "student" },
  memberships: [
    {
      cohortId: "c-1",
      role: "student",
      cohort: { name: "Cohort 3", code: "C3", ...UNEXPECTED },
    },
  ],
  ...UNEXPECTED,
};

describe("Data privacy eval (threshold: every case holds)", () => {
  describe("API responses reach screens through an allow-list", () => {
    it("keeps only the session fields routes and screens read", () => {
      const session = parseSessionBody(JSON.stringify(sessionDto));

      expect(keyPaths(session)).toEqual(SESSION_ALLOW_LIST);
    });

    it("keeps the invitee's email and every id out of the public preview", () => {
      const preview = parseInvitePreview({ ...invitePreview(), ...UNEXPECTED });

      expect(keyPaths(preview)).toEqual(INVITE_PREVIEW_ALLOW_LIST);
    });

    it("keeps only the feedback fields the admin queue renders", () => {
      const page = parseFeedbackList({
        items: [
          {
            ...FEEDBACK_SUMMARY,
            ...UNEXPECTED,
            submittedBy: { ...person, ...UNEXPECTED },
          },
        ],
        meta: { page: 1, totalPages: 1, total: 1, perPage: 20, ...UNEXPECTED },
      });

      expect(keyPaths(page?.items[0])).toEqual(FEEDBACK_SUMMARY_ALLOW_LIST);
      expect(Object.keys(page ?? {}).sort()).toEqual([
        "items",
        "page",
        "total",
        "totalPages",
      ]);
    });

    it("keeps only the feedback fields the detail panel renders", () => {
      const record = parseFeedbackRecord({
        ...FEEDBACK_SUMMARY,
        ...UNEXPECTED,
        cohortId: "c-1",
        details: "Said something unkind.",
        userAgent: "Chrome/128",
        resolvedAt: null,
        resolvedBy: null,
        context: { path: "/campus/c-1", mapId: "m", x: 1, y: 2, ...UNEXPECTED },
      });

      expect(keyPaths(record)).toEqual(FEEDBACK_RECORD_ALLOW_LIST);
    });

    it("keeps only the id of a sent feedback receipt", () => {
      expect(
        parseFeedbackReceipt({ id: "f-1", title: "x", ...UNEXPECTED }),
      ).toEqual({ id: "f-1" });
    });

    it("keeps only the pending-invite fields the confirmation renders", () => {
      const invite = parsePendingInvite({ ...pendingInvite(), ...UNEXPECTED });

      expect(keyPaths(invite)).toEqual(PENDING_INVITE_ALLOW_LIST);
    });
  });

  describe("world frames reach the client through an allow-list", () => {
    function parsedMessage(text: string): ServerMessage | undefined {
      const result = parseServerMessage(text);

      return result.ok ? result.message : undefined;
    }

    it.each(Object.values(serverFrames))(
      "keeps only the protocol fields of a $type frame",
      (frame) => {
        const parsed = parsedMessage(
          JSON.stringify(withUnexpectedFields(frame)),
        );

        expect(keyPaths(parsed)).toEqual(WORLD_FRAME_ALLOW_LIST[frame.type]);
      },
    );

    it("never carries the text of a frame it could not read", () => {
      const unknownType = parseServerMessage(
        JSON.stringify({ type: TOKEN, ...UNEXPECTED }),
      );
      const corruptedWelcome = parseServerMessage(
        JSON.stringify({ type: "welcome", userId: TOKEN, ...UNEXPECTED }),
      );

      expect(JSON.stringify([unknownType, corruptedWelcome])).not.toMatch(
        new RegExp(`${TOKEN}|${UNEXPECTED.phone.slice(1)}`),
      );
    });

    it("drops a call's media token until a feature joins calls", () => {
      const call = parsedMessage(
        JSON.stringify({
          ...serverFrames.call,
          call: { ...serverFrames.call.call, token: TOKEN },
        }),
      );

      expect(call).toEqual({ type: "call" });
      expect(JSON.stringify(call)).not.toContain(TOKEN);
    });

    it("reads an outcome or error code it does not know as unknown, never as the text world sent", () => {
      const parsed = [
        parsedMessage(
          JSON.stringify({ ...serverFrames.moveResult, outcome: TOKEN }),
        ),
        parsedMessage(JSON.stringify({ ...serverFrames.error, code: TOKEN })),
      ];

      expect(parsed).toEqual([
        { ...serverFrames.moveResult, outcome: "unknown" },
        { ...serverFrames.error, code: "unknown" },
      ]);
      expect(JSON.stringify(parsed)).not.toContain(TOKEN);
    });

    it("cannot reach the prototype through a __proto__ key in a frame", () => {
      const parsed = parsedMessage(
        '{"type":"left","userId":"u-1","__proto__":{"isAdmin":true}}',
      );

      expect(parsed).toEqual({ type: "left", userId: "u-1" });
      expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
      expect(Object.hasOwn(parsed ?? {}, "__proto__")).toBe(false);
    });

    it("keeps the close event to a bounded code and reason", () => {
      expect(parseSocketClose(4000, "entered_elsewhere")).toEqual({
        code: 4000,
        reason: "entered_elsewhere",
      });
      // Each field is judged alone, so losing one cannot erase the other.
      expect(parseSocketClose(NaN, "")).toEqual({ code: 0, reason: "" });
      // A close reason past the 123-byte wire limit is dropped, never
      // reported back the way world sent it.
      expect(
        parseSocketClose(1008, `${TOKEN} ${TOKEN} ${TOKEN}`.repeat(20)),
      ).toEqual({ code: 1008, reason: "" });
      expect(parseSocketClose(1008, "🙂".repeat(31))).toEqual({
        code: 1008,
        reason: "",
      });
      expect(
        JSON.stringify(
          parseSocketClose(1008, `${TOKEN} ${TOKEN} ${TOKEN} more`),
        ),
      ).not.toContain(TOKEN);
    });
  });

  describe("analytics events carry only declared properties", () => {
    it("pins every event's property list", () => {
      const declared = Object.fromEntries(
        eventSchemas.map(([name, schema]) => [
          name,
          Object.keys(schema.shape).sort(),
        ]),
      );

      expect(declared).toEqual(ANALYTICS_ALLOW_LIST);
    });

    it.each(eventSchemas)(
      "%s rejects an email in any text property",
      (_, schema) => {
        for (const [key, field] of Object.entries(schema.shape)) {
          expect(
            field.safeParse("ada@campus.local").success,
            `${key} accepted an email`,
          ).toBe(false);
        }
      },
    );

    it.each([
      ["a LiveKit check name", { result: "failed", failed_step: "websocket" }],
      ["the check token", { result: "failed", failed_step: TOKEN }],
      ["a result outside the list", { result: TOKEN, failed_step: null }],
    ])("keeps %s out of the connection check event", (_, properties) => {
      expect(
        analyticsEventSchemas["campus.connection_check_completed"].safeParse(
          properties,
        ).success,
      ).toBe(false);
    });
  });

  describe("the analytics identity and cohort carry only declared properties", () => {
    it("pins the identity and cohort property lists", () => {
      const declared = Object.fromEntries(
        analyticsMemberSchemas.map(([name, schema]) => [
          name,
          Object.keys(schema.shape).sort(),
        ]),
      );

      expect(declared).toEqual(ANALYTICS_MEMBER_ALLOW_LIST);
    });

    it.each(analyticsMemberSchemas)(
      "the %s rejects an email in any property",
      (_, schema) => {
        for (const [key, field] of Object.entries(schema.shape)) {
          expect(
            field.safeParse("ada@campus.local").success,
            `${key} accepted an email`,
          ).toBe(false);
        }
      },
    );
  });

  describe("an invite token never leaves in a URL", () => {
    it("is moved out of the address bar before any page renders", () => {
      const response = moveInviteTokenToCookie(
        new NextRequest(`${ORIGIN}/invitation?token=${TOKEN}`),
      );

      expect(response.headers.get("location")).toBe(`${ORIGIN}/invitation`);
      expect(response.headers.get("location")).not.toContain(TOKEN);
    });

    it("is expired once sign-in spends it", async () => {
      expect(
        await completeGoogleSignIn(
          "/invitation",
          "campus_session=session-token; Path=/",
        ),
      ).toEqual([
        "campus_invite_token=; HttpOnly; Secure; SameSite=Lax; Path=/invitation; Max-Age=0",
      ]);
    });

    it("survives a failed sign-in so the invitee can retry", async () => {
      expect(
        await completeGoogleSignIn("/sign-in?error=invite_required"),
      ).toEqual([]);
    });

    it("is dropped from a returnTo before it reaches sign-in or the OAuth cookie", () => {
      expect(parseReturnTo(`/invitation?token=${TOKEN}`)).toBe("/invitation");
    });

    it("is scrubbed from every PostHog event that still carries one", () => {
      const tokenUrl = `${ORIGIN}/invitation?token=${TOKEN}`;
      const event = scrubAnalyticsEvent({
        uuid: "event-1",
        event: "$pageview",
        properties: { $current_url: tokenUrl, $referrer: tokenUrl },
        $set_once: { $initial_current_url: tokenUrl },
      });

      expect(JSON.stringify(event)).not.toContain(TOKEN);
    });
  });

  describe("an auth response is never cached", () => {
    it("forbids caching a signed-out OAuth callback the backend marked public", async () => {
      vi.stubEnv("API_BASE_URL", "https://api.example.test");
      vi.stubGlobal("fetch", () =>
        Promise.resolve(
          new Response(null, {
            headers: {
              "cache-control": "public, max-age=60",
              expires: "Wed, 21 Oct 2026 07:28:00 GMT",
              location: `${ORIGIN}/sign-in?error=denied`,
            },
            status: 302,
          }),
        ),
      );
      const { GET } = await import("@/app/api/[...path]/route");

      const response = await GET(
        new Request(`${ORIGIN}/api/v1/auth/google/callback?code=google-code`),
        {
          params: Promise.resolve({
            path: ["v1", "auth", "google", "callback"],
          }),
        },
      );

      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("expires")).toBeNull();
    });
  });

  describe("the API proxy never logs a requested path", () => {
    it("keeps an invite token and an email in a mistyped path out of the logs", async () => {
      const logged: string[] = [];
      vi.stubEnv("API_BASE_URL", "https://api.example.test");
      vi.stubGlobal("fetch", () =>
        Promise.resolve(new Response(null, { status: 204 })),
      );
      vi.spyOn(process.stderr, "write").mockImplementation((record) => {
        logged.push(String(record));
        return true;
      });
      const { GET } = await import("@/app/api/[...path]/route");
      const path = ["v1", "invites", "invite-token-123", "ada@campus.local"];

      const response = await GET(
        new Request(`${ORIGIN}/api/${path.join("/")}`),
        {
          params: Promise.resolve({ path }),
        },
      );

      expect(response.status).toBe(404);
      expect(logged).toHaveLength(1);
      expect(logged[0]).not.toContain("invite-token-123");
      expect(logged[0]).not.toContain("ada@campus.local");
    });
  });

  describe("the world origin only names a host the browser can reach", () => {
    it.each([
      "http://world.railway.internal:8001",
      "https://world.railway.internal",
      "https://WORLD.RAILWAY.INTERNAL",
      "https://world.railway.internal.",
    ])("refuses the Railway private host %s", (origin) => {
      expect(() => readWorldOrigin({ NEXT_PUBLIC_WORLD_URL: origin })).toThrow(
        "NEXT_PUBLIC_WORLD_URL",
      );
    });
  });

  describe("the connection check only connects to the pinned media host", () => {
    const MEDIA_ORIGIN = "wss://media.campus.example";
    const grant = {
      url: MEDIA_ORIGIN,
      room: "connection-check-0b9e",
      token: TOKEN,
      expiresAt: "2026-10-24T12:02:00.000Z",
    };

    function accessFor(reply: Response): Promise<ConnectionCheckAccess> {
      return requestConnectionCheck({
        fetch: async () => reply,
        worldOrigin: "https://ws.campus.example",
        mediaOrigin: MEDIA_ORIGIN,
      });
    }

    it.each([
      "wss://evil.example",
      "wss://media.campus.example@evil.example",
      "ws://media.campus.example",
      "wss://media.campus.example.evil.example",
      "wss://media.campus.example:8443",
    ])("never hands the token to the unpinned host %s", async (url) => {
      const access = await accessFor(Response.json({ ...grant, url }));

      expect(access).toEqual({ kind: "failed" });
      expect(JSON.stringify(access)).not.toContain(TOKEN);
    });

    it("keeps only the URL and token from world's answer", async () => {
      const access = await accessFor(
        Response.json(withUnexpectedFields(grant)),
      );

      expect(keyPaths(access)).toEqual(["kind", "token", "url"]);
    });

    it("never carries or logs the token on a refusal", async () => {
      const consoleCalls = (
        ["debug", "error", "info", "log", "warn"] as const
      ).map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
      const refusals = await Promise.all(
        [401, 403, 429, 500, 503].map((status) =>
          accessFor(
            Response.json(
              { error: { code: TOKEN, message: TOKEN }, ...grant },
              { status, headers: { "retry-after": TOKEN } },
            ),
          ),
        ),
      );

      expect(refusals.map(({ kind }) => kind)).toEqual([
        "signed-out",
        "failed",
        "rate-limited",
        "failed",
        "failed",
      ]);
      expect(JSON.stringify(refusals)).not.toContain(TOKEN);
      expect(consoleCalls.flatMap((spy) => spy.mock.calls)).toEqual([]);
    });
  });

  describe("the connection check only uses the devices the member turned on", () => {
    const GRANT = { url: "wss://media.campus.example", token: TOKEN };

    it("never opens or publishes a source the member turned off", async () => {
      const livekit = fakeLivekit();
      const probe = await loadLivekitProbe(GRANT, async () => livekit.module);
      const onStep = vi.fn();

      await expect(
        runConnectionCheck(probe, () => null, { onStep }),
      ).resolves.toEqual({ kind: "passed" });
      expect(livekit.published).toEqual([]);
      expect(onStep).toHaveBeenCalledWith("microphone", "skipped");
      expect(onStep).toHaveBeenCalledWith("camera", "skipped");
    });

    it.each([
      ["a track that sends", {}],
      ["a track that sends nothing", { packetsSent: 0 }],
      ["a track that cannot be published", { publishFails: true }],
    ])("never stops the member's own track: %s", async (_, options) => {
      vi.useFakeTimers();
      try {
        const livekit = fakeLivekit(options);
        const probe = await loadLivekitProbe(GRANT, async () => livekit.module);
        const microphone = fakeTrack("audio");
        const published = probe.publish(microphone);
        await vi.runAllTimersAsync();
        await published;

        expect(microphone.stop).not.toHaveBeenCalled();
        expect(microphone.copy.stop).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });

    it.each<ConnectionCheckAccess>([
      { kind: "unavailable" },
      { kind: "rate-limited", retryAfterSeconds: 60 },
      { kind: "signed-out" },
      { kind: "failed" },
    ])(
      "never downloads the media SDK when world answers $kind",
      async (access) => {
        const loadProbe = vi.fn();

        await checkConnection(
          {
            requestAccess: async () => access,
            loadProbe,
            captureEvent: () => {},
          },
          (step) => fakeTrack(step === "microphone" ? "audio" : "video"),
          { onStep: () => {} },
        );

        expect(loadProbe).not.toHaveBeenCalled();
      },
    );
  });

  describe("a protected build only sends traffic to the hosts it names", () => {
    const protectedBuild = {
      CI: "true",
      NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_project",
      NEXT_PUBLIC_SANITY_DATASET: "staging",
      NEXT_PUBLIC_SANITY_PROJECT_ID: "sj3zsz66",
      NEXT_PUBLIC_WORLD_URL: "https://ws.campus.example",
    };

    it("accepts a public HTTPS world origin", () => {
      expect(() => validateBuildEnvironment(protectedBuild)).not.toThrow();
    });

    it.each([
      "http://localhost:8001",
      "https://world.railway.internal",
      "https://world.railway.internal.",
      "https://user:secret@ws.campus.example",
      "https://ws.campus.example/socket",
      "https://ws.campus.example/?cohortId=1",
    ])(
      "rejects the world URL %s before the browser opens a socket to it",
      (worldUrl) => {
        expect(() =>
          validateBuildEnvironment({
            ...protectedBuild,
            NEXT_PUBLIC_WORLD_URL: worldUrl,
          }),
        ).toThrow("NEXT_PUBLIC_WORLD_URL");
      },
    );

    it.each([
      "ws://media.campus.example",
      "ws://localhost:7880",
      "wss://media.railway.internal",
      "wss://user:secret@media.campus.example",
      "wss://media.campus.example/rtc",
    ])(
      "rejects the media URL %s before a connection check token is sent to it",
      (mediaUrl) => {
        expect(() =>
          validateBuildEnvironment({
            ...protectedBuild,
            NEXT_PUBLIC_MEDIA_URL: mediaUrl,
          }),
        ).toThrow("NEXT_PUBLIC_MEDIA_URL");
      },
    );

    it.each(["evil.example", "a/b", "x@evil.example", "x#"])(
      "rejects the Sanity project ID %s before it reaches the map API host",
      (projectId) => {
        expect(() =>
          validateBuildEnvironment({
            ...protectedBuild,
            NEXT_PUBLIC_SANITY_PROJECT_ID: projectId,
          }),
        ).toThrow("NEXT_PUBLIC_SANITY_PROJECT_ID");
      },
    );

    it("rejects an uppercase project ID, which no Sanity asset path would match", () => {
      expect(() =>
        validateBuildEnvironment({
          ...protectedBuild,
          NEXT_PUBLIC_SANITY_PROJECT_ID: "SJ3ZSZ66",
        }),
      ).toThrow("NEXT_PUBLIC_SANITY_PROJECT_ID");
    });

    it.each(["../production", "a/b", "staging?x"])(
      "rejects the dataset name %s before it reaches a map URL path",
      (dataset) => {
        expect(() =>
          validateBuildEnvironment({
            ...protectedBuild,
            NEXT_PUBLIC_SANITY_DATASET: dataset,
          }),
        ).toThrow("NEXT_PUBLIC_SANITY_DATASET");
      },
    );

    it("accepts a dataset name Sanity allows, such as production_old", () => {
      expect(() =>
        validateBuildEnvironment({
          ...protectedBuild,
          NEXT_PUBLIC_SANITY_DATASET: "production_old",
        }),
      ).not.toThrow();
    });

    it("rejects a PostHog host reached over plain HTTP", () => {
      expect(() =>
        validateBuildEnvironment({
          ...protectedBuild,
          NEXT_PUBLIC_POSTHOG_HOST: "http://eu.i.posthog.com",
        }),
      ).toThrow("NEXT_PUBLIC_POSTHOG_HOST");
    });
  });
});
