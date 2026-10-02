import { type SetupServer, setupServer } from "msw/node";
import { vi } from "vitest";

export const TEST_ORIGIN = "https://frontend.example.test";

export interface RecordedRequest {
  method: string;
  url: string;
  cookie: string | null;
  sentAt: number;
}

export interface MockApi {
  server: SetupServer;
  requests: RecordedRequest[];
  reset(): void;
  close(): void;
}

export type Reply = () => Response | Promise<Response>;

// Node's Request rejects relative URLs; browsers resolve "/api/..." against
// the page origin. Mirror the browser so browserApi works unchanged.
function resolveRelativeRequests(origin: string) {
  class SameOriginRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(
        typeof input === "string" || input instanceof URL
          ? new URL(input, origin)
          : input,
        init,
      );
    }
  }
  vi.stubGlobal("Request", SameOriginRequest);
}

// Call inside vi.hoisted: API clients capture fetch and Request when they are
// created, so MSW must patch fetch before the code under test is imported.
export function startMockApi(): MockApi {
  resolveRelativeRequests(TEST_ORIGIN);

  const server = setupServer();
  const requests: RecordedRequest[] = [];

  server.events.on("request:start", ({ request }) => {
    requests.push({
      method: request.method,
      url: request.url,
      cookie: request.headers.get("cookie"),
      sentAt: Date.now(),
    });
  });
  server.listen({ onUnhandledRequest: "error" });

  return {
    server,
    requests,
    reset: () => {
      server.resetHandlers();
      requests.length = 0;
    },
    close: () => server.close(),
  };
}

export function inOrder(...replies: Reply[]): Reply {
  return () => {
    const reply = replies.shift();
    if (!reply) throw new Error("Unexpected extra request.");
    return reply();
  };
}
