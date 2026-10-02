import { type APIRequestContext, test as base } from "@playwright/test";

export const FAKE_API_ORIGIN = `http://127.0.0.1:${process.env.FAKE_API_PORT ?? 3101}`;

export interface ScriptedReply {
  status: number;
  headers?: Record<string, string>;
}

export interface LoggedRequest {
  method: string;
  path: string;
  cookie: string | null;
}

export class FakeApi {
  constructor(private readonly control: APIRequestContext) {}

  async scriptRefresh(...replies: ScriptedReply[]): Promise<void> {
    await this.control.post("/__scenario", { data: { refresh: replies } });
  }

  async refreshPosts(): Promise<LoggedRequest[]> {
    const response = await this.control.get("/__requests");
    const requests = (await response.json()) as LoggedRequest[];
    return requests.filter(
      (request) =>
        request.method === "POST" && request.path === "/v1/auth/refresh",
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
