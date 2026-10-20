import {
  type APIRequestContext,
  type BrowserContext,
  test as base,
  type WebSocketRoute,
} from "@playwright/test";

import { serverFrames } from "../../fixtures/world-frames";
import { E2E_MAP } from "./sanity-stub";

export const FAKE_API_ORIGIN = `http://127.0.0.1:${process.env.FAKE_API_PORT ?? 3101}`;

export interface ScriptedReply {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface LoggedRequest {
  method: string;
  path: string;
  search: string;
  cookie: string | null;
  body: string;
}

interface MembershipFixture {
  cohortId: string;
  role: "student" | "professor" | "mentor" | "guest";
  cohort: { name: string; code: string };
}

export function membership(cohortId: string, name: string): MembershipFixture {
  return {
    cohortId,
    role: "student",
    cohort: { name, code: name.toUpperCase().replaceAll(" ", "") },
  };
}

export const INVITE_ID = "66666666-6666-4666-8666-666666666666";

function sessionBody(
  scope: "provisional" | "full_access",
  systemRole: "user" | "admin",
  memberships: MembershipFixture[],
  inviteId: string | null = null,
) {
  return {
    scope,
    expiresAt: "2099-01-01T00:15:00.000Z",
    inviteId,
    user: {
      id: "55555555-5555-4555-8555-555555555555",
      email: "ada@campus.local",
      systemRole,
    },
    membership: memberships[0] ?? null,
    memberships,
  };
}

export const sessions = {
  member: (...memberships: MembershipFixture[]): ScriptedReply => ({
    status: 200,
    body: sessionBody("full_access", "user", memberships),
  }),
  invitedMember: (...memberships: MembershipFixture[]): ScriptedReply => ({
    status: 200,
    body: sessionBody("full_access", "user", memberships, INVITE_ID),
  }),
  admin: (...memberships: MembershipFixture[]): ScriptedReply => ({
    status: 200,
    body: sessionBody("full_access", "admin", memberships),
  }),
  provisional: (inviteId: string | null = INVITE_ID): ScriptedReply => ({
    status: 200,
    body: sessionBody("provisional", "user", [], inviteId),
  }),
};

// A session whose access token lapses at expiresAt (epoch ms), for renewal tests.
export function expiringAt(reply: ScriptedReply, expiresAt: number) {
  return {
    ...reply,
    body: {
      ...(reply.body as object),
      expiresAt: new Date(expiresAt).toISOString(),
    },
  };
}

export const invites = {
  preview: (cohortName = "Cohort 3"): ScriptedReply => ({
    status: 200,
    body: {
      email: "ada@campus.local",
      cohort: { name: cohortName, code: "C3" },
      track: { name: "Backend Engineering", code: "BE" },
      cohortRole: "student",
      systemRole: "user",
      invitedBy: { firstName: "Ejemen", lastName: "Iboi" },
      expiresAt: "2099-01-01T00:00:00.000Z",
      guestAccessExpiresAt: null,
    },
  }),
  accepted: (cohortId: string | null): ScriptedReply => ({
    status: 200,
    body: {
      inviteId: INVITE_ID,
      status: "accepted",
      decidedAt: "2026-10-03T12:00:00.000Z",
      membership: cohortId
        ? { cohortId, role: "student", joinedAt: "2026-10-03T12:00:00.000Z" }
        : null,
      systemRole: "user",
    },
  }),
  failure: (status: number, code: string): ScriptedReply => ({
    status,
    body: { error: { code, message: "scripted" } },
  }),
};

export function cohortsPage(page: number, totalPages: number, names: string[]) {
  return {
    items: names.map((name) => ({
      id: name.toLowerCase(),
      name,
      code: name.toUpperCase(),
      startDate: null,
      endDate: null,
      status: "active",
      createdAt: "2026-09-22T12:00:00.000Z",
      updatedAt: "2026-09-22T12:00:00.000Z",
    })),
    meta: { page, perPage: names.length, total: totalPages, totalPages },
  };
}

// expiresAt (epoch ms) makes the browser drop the access cookie then, as it
// does with the backend's Expires attribute.
export async function signIn(
  context: BrowserContext,
  baseURL?: string,
  { expiresAt }: { expiresAt?: number } = {},
) {
  await context.addCookies([
    {
      name: "campus_session",
      value: "session-token",
      domain: new URL(baseURL ?? "http://127.0.0.1").hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      ...(expiresAt && { expires: expiresAt / 1000 }),
    },
  ]);
}

export class FakeApi {
  constructor(private readonly control: APIRequestContext) {}

  async scriptRefresh(...replies: ScriptedReply[]): Promise<void> {
    await this.scenario({ refresh: replies });
  }

  async scriptLogout(...replies: ScriptedReply[]): Promise<void> {
    await this.scenario({ logout: replies });
  }

  async scriptSession(reply: ScriptedReply | null): Promise<void> {
    await this.scenario({ session: reply });
  }

  async scriptCohortPages(pages: Record<number, unknown>): Promise<void> {
    await this.scenario({ cohorts: pages });
  }

  async scriptInvitePreview(reply: ScriptedReply): Promise<void> {
    await this.scenario({ preview: reply });
  }

  async scriptPendingInvite(reply: ScriptedReply): Promise<void> {
    await this.scenario({ pendingInvite: reply });
  }

  // sessionAfterAccept replaces the session read once an accept succeeds.
  async scriptDecision(
    replies: ScriptedReply[],
    sessionAfterAccept?: ScriptedReply,
  ): Promise<void> {
    await this.scenario({ decision: replies, sessionAfterAccept });
  }

  async refreshPosts(): Promise<LoggedRequest[]> {
    return this.requestsTo("POST", "/v1/auth/refresh");
  }

  async logoutPosts(): Promise<LoggedRequest[]> {
    return this.requestsTo("POST", "/v1/auth/logout");
  }

  async sessionReads(): Promise<LoggedRequest[]> {
    return this.requestsTo("GET", "/v1/auth/me");
  }

  async cohortReads(): Promise<LoggedRequest[]> {
    return this.requestsTo("GET", "/v1/cohorts");
  }

  async previewPosts(): Promise<LoggedRequest[]> {
    return this.requestsTo("POST", "/v1/invites/preview");
  }

  async pendingInviteReads(): Promise<LoggedRequest[]> {
    return this.requestsTo("GET", "/v1/invites/validate-user-invite");
  }

  async decisionPosts(): Promise<LoggedRequest[]> {
    return this.requestsTo("POST", "/v1/invites/decision");
  }

  private async scenario(scenario: Record<string, unknown>): Promise<void> {
    await this.control.post("/__scenario", { data: scenario });
  }

  private async requestsTo(
    method: string,
    path: string,
  ): Promise<LoggedRequest[]> {
    const response = await this.control.get("/__requests");
    const requests = (await response.json()) as LoggedRequest[];
    return requests.filter(
      (request) => request.method === method && request.path === path,
    );
  }
}

const WORLD_SOCKET = /\/socket\?cohortId=/;

type WorldSocketHandler = (socket: WebSocketRoute) => void;

export interface FakeWorld {
  replaceHandler(handler: WorldSocketHandler): void;
}

export function admitToWorld(socket: WebSocketRoute) {
  socket.send(JSON.stringify(serverFrames.welcome));
  // world announces the map it is running; the Sanity stub publishes the
  // same one.
  socket.send(JSON.stringify({ ...serverFrames.snapshot, map: E2E_MAP }));
}

export const test = base.extend<{ fakeApi: FakeApi; world: FakeWorld }>({
  // Builds carry a real NEXT_PUBLIC_WORLD_URL; without this, Join would open a
  // socket to it with no session and reload on world's no_token.
  world: [
    async ({ context }, provide) => {
      let handler: WorldSocketHandler = admitToWorld;
      await context.routeWebSocket(WORLD_SOCKET, (socket) => handler(socket));
      await provide({
        replaceHandler(nextHandler) {
          handler = nextHandler;
        },
      });
    },
    { auto: true },
  ],
  // Named `provide`, not Playwright's usual `use`, so react-hooks lint does not
  // mistake the fixture callback for React's use() hook.
  fakeApi: async ({ playwright }, provide) => {
    const control = await playwright.request.newContext({
      baseURL: FAKE_API_ORIGIN,
    });
    await control.post("/__reset");
    await provide(new FakeApi(control));
    await control.dispose();
  },
});
