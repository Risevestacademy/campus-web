import {
  type APIRequestContext,
  type BrowserContext,
  test as base,
} from "@playwright/test";

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

function sessionBody(
  scope: "provisional" | "full_access",
  systemRole: "user" | "admin",
  memberships: MembershipFixture[],
) {
  return {
    scope,
    expiresAt: "2099-01-01T00:15:00.000Z",
    inviteId: null,
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
  admin: (...memberships: MembershipFixture[]): ScriptedReply => ({
    status: 200,
    body: sessionBody("full_access", "admin", memberships),
  }),
  provisional: (): ScriptedReply => ({
    status: 200,
    body: sessionBody("provisional", "user", []),
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

export async function signIn(context: BrowserContext, baseURL?: string) {
  await context.addCookies([
    {
      name: "campus_session",
      value: "session-token",
      domain: new URL(baseURL ?? "http://127.0.0.1").hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export class FakeApi {
  constructor(private readonly control: APIRequestContext) {}

  async scriptRefresh(...replies: ScriptedReply[]): Promise<void> {
    await this.scenario({ refresh: replies });
  }

  async scriptSession(reply: ScriptedReply | null): Promise<void> {
    await this.scenario({ session: reply });
  }

  async scriptCohortPages(pages: Record<number, unknown>): Promise<void> {
    await this.scenario({ cohorts: pages });
  }

  async refreshPosts(): Promise<LoggedRequest[]> {
    return this.requestsTo("POST", "/v1/auth/refresh");
  }

  async sessionReads(): Promise<LoggedRequest[]> {
    return this.requestsTo("GET", "/v1/auth/me");
  }

  async cohortReads(): Promise<LoggedRequest[]> {
    return this.requestsTo("GET", "/v1/cohorts");
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

export const test = base.extend<{ fakeApi: FakeApi }>({
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
