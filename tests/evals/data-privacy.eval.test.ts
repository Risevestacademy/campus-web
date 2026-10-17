// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { validateBuildEnvironment } from "@/config/environment/validation";
import { analyticsEventSchemas } from "@/core/analytics/events";
import { scrubAnalyticsEvent } from "@/core/analytics/scrub";
import { parseServerMessage, type ServerMessage } from "@/core/realtime";
import { readWorldOrigin } from "@/core/realtime/configuration";
import { parseReturnTo } from "@/features/auth/schemas/return-to";
import { parseSessionBody } from "@/features/auth/schemas/session.schema";
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

const SESSION_ALLOW_LIST = [
  "expiresAt",
  "inviteId",
  "memberships[].cohort.code",
  "memberships[].cohort.name",
  "memberships[].cohortId",
  "scope",
  "user.displayName",
  "user.email",
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
  "campus.presence_tab_conflict_shown": ["surface"],
  "campus.presence_tab_moved": ["surface"],
  "campus_world.map_failed": ["error_kind", "map_id"],
  "campus_world.map_loaded": ["load_ms", "map_id", "tilesets", "version"],
  "campus_world.map_ready": ["first_frame_ms", "map_id", "version"],
  "cohort.created": ["cohort_status"],
  "identity.profile_setup_completed": ["cohort_id", "role", "track_id"],
  "identity.profile_setup_started": ["cohort_id", "role", "track_id"],
};

const PLAYER_PATHS = ["facing", "userId", "x", "y"];
const AVATAR_PATHS = [...PLAYER_PATHS, "displayName", "spriteKey"].sort();

function under(prefix: string, paths: string[]): string[] {
  return paths.map((path) => `${prefix}.${path}`);
}

const WORLD_FRAME_ALLOW_LIST: Record<ServerMessage["type"], string[]> = {
  appearance: ["displayName", "spriteKey", "type", "userId"],
  error: ["code", "message", "type"],
  joined: [...under("player", AVATAR_PATHS), "type"],
  left: ["type", "userId"],
  moveResult: ["outcome", ...under("player", PLAYER_PATHS), "seq", "type"],
  moved: [...under("players[]", PLAYER_PATHS), "type"],
  pong: ["type"],
  replaced: ["type"],
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
