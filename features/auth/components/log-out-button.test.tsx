import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http } from "msw";
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
import { withQueryClient } from "@/tests/fixtures/query-client";

import { LogOutAction } from "./log-out-action";
import { LogOutButton } from "./log-out-button";

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
vi.mock("server-only", () => ({}));

const LOGOUT_URL = `${TEST_ORIGIN}/api/v1/auth/logout`;
const CAMPUS_PATH = "/campus/c-3";
const LOGGED_OUT_SEQUENCE = [
  'capture auth.logout {"logout_source":"user_action"}',
  "reset analytics user",
  "replace document /sign-in",
];

const status =
  (code: number): Reply =>
  () =>
    new Response(null, { status: code });
const neverAnswers: Reply = () => new Promise<Response>(() => {});

function logoutReplies(...replies: Reply[]) {
  mockApi.server.use(http.post(LOGOUT_URL, inOrder(...replies)));
}

const logoutPosts = () =>
  mockApi.requests.filter(
    (request) => request.method === "POST" && request.url === LOGOUT_URL,
  );

function renderButton() {
  render(
    <>
      {withQueryClient(<LogOutButton />)}
      <Toaster />
    </>,
  );
}

const logOutButton = () =>
  screen.getByRole("button", { name: /Log(ging)? out/ });

beforeEach(() => {
  sideEffects.length = 0;
  window.history.replaceState(null, "", CAMPUS_PATH);
});

afterEach(() => {
  toast.close();
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("LogOutButton", () => {
  it("logs out the same way as the account menu", async () => {
    logoutReplies(status(204));
    renderButton();

    fireEvent.click(logOutButton());

    await waitFor(() => {
      expect(sideEffects).toEqual(LOGGED_OUT_SEQUENCE);
    });
    expect(logoutPosts()).toHaveLength(1);
  });

  it("is disabled while the request is in flight, so it is sent once", async () => {
    logoutReplies(neverAnswers);
    renderButton();

    fireEvent.click(logOutButton());

    await waitFor(() => {
      expect(logOutButton()).toHaveTextContent("Logging out…");
    });
    expect(logOutButton()).toBeDisabled();
    fireEvent.click(logOutButton());
    expect(logoutPosts()).toHaveLength(1);
  });

  it("keeps the visitor signed in and says so when logging out fails", async () => {
    logoutReplies(status(503));
    renderButton();

    fireEvent.click(logOutButton());

    expect(
      await screen.findByText("We couldn't log you out"),
    ).toBeInTheDocument();
    expect(sideEffects).toEqual([]);
    expect(logOutButton()).toBeEnabled();
  });

  it("can try again after a failure", async () => {
    logoutReplies(status(503), status(204));
    renderButton();

    fireEvent.click(logOutButton());
    await screen.findByText("We couldn't log you out");
    fireEvent.click(logOutButton());

    await waitFor(() => {
      expect(sideEffects).toEqual(LOGGED_OUT_SEQUENCE);
    });
    expect(logoutPosts()).toHaveLength(2);
  });
});

describe("LogOutAction", () => {
  it("sends one request when asked twice before the in-flight state renders", async () => {
    logoutReplies(neverAnswers);
    render(
      withQueryClient(
        <LogOutAction>
          {({ logOut }) => (
            <button
              type="button"
              onClick={() => {
                logOut();
                logOut();
              }}
            >
              Log out
            </button>
          )}
        </LogOutAction>,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(logoutPosts()).toHaveLength(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(logoutPosts()).toHaveLength(1);
  });
});
