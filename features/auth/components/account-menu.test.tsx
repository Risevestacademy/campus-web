import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
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

import { AccountMenu } from "../index";

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
const CAMPUS_ENTRY_COOKIES = ["campus_entry_c-3", "campus_entry_c-4"];
const COOKIE_PATHS = ["/campus", "/"];
const UNRELATED_COOKIE = "theme=dark";
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

function visibleCookies(): string[] {
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean);
}

const campusEntryCookies = () =>
  visibleCookies().filter((cookie) => cookie.startsWith("campus_entry_"));

// Markers from before entry moved under /campus still live at the root path.
function rememberCampusEntries() {
  for (const name of CAMPUS_ENTRY_COOKIES) {
    for (const path of COOKIE_PATHS) {
      document.cookie = `${name}=1; Path=${path}; SameSite=Lax`;
    }
  }
  document.cookie = `${UNRELATED_COOKIE}; Path=/`;
}

function forgetCookies() {
  for (const cookie of visibleCookies()) {
    const [name] = cookie.split("=", 1);
    for (const path of COOKIE_PATHS) {
      document.cookie = `${name}=; Path=${path}; Max-Age=0`;
    }
  }
}

function logoutReplies(...replies: Reply[]) {
  mockApi.server.use(http.post(LOGOUT_URL, inOrder(...replies)));
}

const logoutPosts = () =>
  mockApi.requests.filter(
    (request) => request.method === "POST" && request.url === LOGOUT_URL,
  );

function renderMenu() {
  render(
    <>
      {withQueryClient(
        <AccountMenu>
          <span>A</span>
        </AccountMenu>,
      )}
      <Toaster />
    </>,
  );
}

async function openLogOut() {
  fireEvent.click(screen.getByRole("button", { name: "Account" }));
  return screen.findByRole("menuitem", { name: /Log(ging)? out/ });
}

async function logOut() {
  fireEvent.click(await openLogOut());
}

beforeEach(() => {
  sideEffects.length = 0;
  window.history.replaceState(null, "", CAMPUS_PATH);
  forgetCookies();
});

afterEach(() => {
  toast.close();
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("AccountMenu: logging out", () => {
  it.each([
    ["the backend ends the session", 204],
    ["the session had already ended", 401],
  ])(
    "records the logout, forgets the analytics user and every campus entry, then leaves for sign-in when %s",
    async (_, code) => {
      rememberCampusEntries();
      logoutReplies(status(code));
      renderMenu();

      await logOut();

      await waitFor(() => {
        expect(sideEffects).toEqual(LOGGED_OUT_SEQUENCE);
      });
      expect(logoutPosts()).toHaveLength(1);
      expect(visibleCookies()).toEqual([UNRELATED_COOKIE]);
    },
  );
});

describe("AccountMenu: failed logout", () => {
  it.each([
    ["a server error", status(503)],
    ["a network failure", () => HttpResponse.error()],
  ])("keeps the visitor signed in and explains after %s", async (_, reply) => {
    rememberCampusEntries();
    logoutReplies(reply);
    renderMenu();

    await logOut();

    expect(
      await screen.findByText("We couldn't log you out"),
    ).toBeInTheDocument();
    expect(sideEffects).toEqual([]);
    expect(campusEntryCookies()).toHaveLength(4);
  });

  it("lets the visitor try again after a failure", async () => {
    logoutReplies(status(503), status(204));
    renderMenu();

    await logOut();
    await screen.findByText("We couldn't log you out");
    await logOut();

    await waitFor(() => {
      expect(sideEffects).toEqual(LOGGED_OUT_SEQUENCE);
    });
    expect(logoutPosts()).toHaveLength(2);
  });
});

describe("AccountMenu: pending logout", () => {
  it("disables log out while the request is in flight, so it is sent once", async () => {
    logoutReplies(neverAnswers);
    renderMenu();

    await logOut();
    const pending = await openLogOut();

    expect(pending).toHaveTextContent("Logging out…");
    expect(pending).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(pending);
    expect(logoutPosts()).toHaveLength(1);
  });
});
