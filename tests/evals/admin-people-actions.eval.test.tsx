import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { PersonActions } from "@/features/admin/people/components/person-actions";
import type { PersonActionsAvailable } from "@/features/admin/people/person-actions";
import { toast, Toaster } from "@/shared/ui/toast";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const sideEffects = vi.hoisted(() => [] as string[]);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => sideEffects.push(`push ${href}`),
    refresh: () => sideEffects.push("refresh"),
  }),
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => sideEffects.push(`go ${href}`),
}));

const API = `${TEST_ORIGIN}/api/v1/users/user-1`;
const ROLE_URL = `${API}/system-role`;
const SUSPEND_URL = `${API}/suspend`;
const REINSTATE_URL = `${API}/reinstate`;
const NAME = "Ada Lovelace";

const ACTIVE_USER: PersonActionsAvailable = {
  roleChange: "admin",
  suspend: true,
  reinstate: false,
};
const SUSPENDED_ADMIN: PersonActionsAvailable = {
  roleChange: "user",
  suspend: false,
  reinstate: true,
};

function failure(status: number, code: string) {
  return () => Response.json({ error: { code } }, { status });
}

function renderActions(actions: PersonActionsAvailable = ACTIVE_USER) {
  render(
    <>
      {withQueryClient(
        <PersonActions userId="user-1" name={NAME} actions={actions} />,
      )}
      <Toaster />
    </>,
  );
}

function choose(item: string) {
  fireEvent.click(screen.getByRole("button", { name: `Manage ${NAME}` }));
  fireEvent.click(screen.getByRole("menuitem", { name: item }));
}

function confirm(name: string) {
  return screen.getByRole("button", { name });
}

function browserRequests() {
  return mockApi.requests.filter(({ url }) =>
    url.startsWith(`${TEST_ORIGIN}/api/`),
  );
}

afterEach(() => {
  cleanup();
  toast.close();
  mockApi.reset();
  sideEffects.length = 0;
});

afterAll(() => mockApi.close());

describe("Change system role eval (threshold: 0 mismatched outcomes; exactly 1 request per double click)", () => {
  it.each([
    [ACTIVE_USER, "Promote to admin", "admin", "Promoted to admin"],
    [SUSPENDED_ADMIN, "Demote from admin", "user", "Demoted from admin"],
  ] as const)(
    "sends only the new role, once, then refreshes (%#)",
    async (actions, label, systemRole, toastTitle) => {
      const bodies: unknown[] = [];
      mockApi.server.use(
        http.patch(ROLE_URL, async ({ request }) => {
          bodies.push(await request.json());
          return Response.json({ id: "user-1", email: "a@b.c", systemRole });
        }),
      );
      renderActions(actions);

      choose(label);
      fireEvent.click(confirm(label));
      fireEvent.click(confirm(label));

      expect(await screen.findByText(toastTitle)).toBeVisible();
      expect(bodies).toEqual([{ systemRole }]);
      expect(sideEffects).toEqual(["refresh"]);
      expect(browserRequests()).toHaveLength(1);
    },
  );

  it.each([
    [
      409,
      "CONFLICT",
      "A super admin's role, and your own, can't be changed here.",
    ],
    [403, "FORBIDDEN", "You no longer have permission to change roles."],
    [404, "NOT_FOUND", "This account no longer exists. Refresh the page."],
    [
      500,
      "INTERNAL_ERROR",
      "We couldn't change this role. Nothing was changed.",
    ],
  ])(
    "explains a %i %s and keeps the dialog open",
    async (status, code, text) => {
      mockApi.server.use(http.patch(ROLE_URL, failure(status, code)));
      renderActions();

      choose("Promote to admin");
      fireEvent.click(confirm("Promote to admin"));

      expect(await screen.findByRole("alert")).toHaveTextContent(text);
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(sideEffects).toEqual([]);
    },
  );
});

describe("Suspend eval (threshold: 0 mismatched outcomes; 0 requests for an invalid reason)", () => {
  it("sends the trimmed reason and nothing else", async () => {
    const bodies: unknown[] = [];
    mockApi.server.use(
      http.post(SUSPEND_URL, async ({ request }) => {
        bodies.push(await request.json());
        return Response.json({
          id: "user-1",
          email: "a@b.c",
          status: "suspended",
        });
      }),
    );
    renderActions();

    choose("Suspend");
    fireEvent.change(screen.getByLabelText("Reason (optional)"), {
      target: { value: "  Shared an exam answer  " },
    });
    fireEvent.click(confirm("Suspend"));
    fireEvent.click(confirm("Suspend"));

    expect(await screen.findByText("Account suspended")).toBeVisible();
    expect(bodies).toEqual([{ reason: "Shared an exam answer" }]);
    expect(sideEffects).toEqual(["refresh"]);
    expect(browserRequests()).toHaveLength(1);
  });

  it("sends no reason when it is left blank", async () => {
    const bodies: unknown[] = [];
    mockApi.server.use(
      http.post(SUSPEND_URL, async ({ request }) => {
        bodies.push(await request.json());
        return Response.json({
          id: "user-1",
          email: "a@b.c",
          status: "suspended",
        });
      }),
    );
    renderActions();

    choose("Suspend");
    fireEvent.change(screen.getByLabelText("Reason (optional)"), {
      target: { value: "   " },
    });
    fireEvent.click(confirm("Suspend"));

    expect(await screen.findByText("Account suspended")).toBeVisible();
    expect(bodies).toEqual([{}]);
  });

  it("refuses a reason over 500 characters without a request, and does not echo it", async () => {
    renderActions();

    choose("Suspend");
    const reason = "x".repeat(501);
    const field = screen.getByLabelText("Reason (optional)");
    // `maxLength` stops typing, not a pasted or scripted value.
    field.removeAttribute("maxLength");
    fireEvent.change(field, { target: { value: reason } });
    fireEvent.click(confirm("Suspend"));

    expect(
      await screen.findByText("Keep the reason to 500 characters or fewer."),
    ).toBeVisible();
    expect(screen.getByRole("dialog")).not.toHaveTextContent(reason);
    expect(browserRequests()).toHaveLength(0);
  });

  it.each([
    [403, "FORBIDDEN", "Only a super admin can suspend another super admin."],
    [409, "CONFLICT", "This account is already suspended. Refresh the page."],
    [
      400,
      "INVALID_ARGUMENT",
      "campus-api rejected this request. Check the reason and try again.",
    ],
  ])("explains a %i %s", async (status, code, text) => {
    mockApi.server.use(http.post(SUSPEND_URL, failure(status, code)));
    renderActions();

    choose("Suspend");
    fireEvent.click(confirm("Suspend"));

    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(sideEffects).toEqual([]);
  });

  it("goes to sign-in when the session has lapsed", async () => {
    mockApi.server.use(http.post(SUSPEND_URL, failure(401, "UNAUTHORIZED")));
    renderActions();

    choose("Suspend");
    fireEvent.click(confirm("Suspend"));

    await waitFor(() => expect(sideEffects).toEqual(["go /sign-in"]));
  });
});

describe("Reinstate eval (threshold: 0 mismatched outcomes; exactly 1 request per double click)", () => {
  it("reinstates once and says so, then refreshes", async () => {
    mockApi.server.use(
      http.post(REINSTATE_URL, () =>
        Response.json({ id: "user-1", email: "a@b.c", status: "active" }),
      ),
    );
    renderActions(SUSPENDED_ADMIN);

    choose("Reinstate");
    fireEvent.click(confirm("Reinstate"));
    fireEvent.click(confirm("Reinstate"));

    expect(await screen.findByText("Account reinstated")).toBeVisible();
    expect(sideEffects).toEqual(["refresh"]);
    expect(browserRequests()).toHaveLength(1);
  });

  it.each([
    [
      403,
      "FORBIDDEN",
      "Only a super admin can lift a suspension a super admin made.",
    ],
    [
      409,
      "CONFLICT",
      "This account isn't suspended any more. Refresh the page.",
    ],
  ])("explains a %i %s", async (status, code, text) => {
    mockApi.server.use(http.post(REINSTATE_URL, failure(status, code)));
    renderActions(SUSPENDED_ADMIN);

    choose("Reinstate");
    fireEvent.click(confirm("Reinstate"));

    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it("explains a network failure", async () => {
    mockApi.server.use(http.post(REINSTATE_URL, () => HttpResponse.error()));
    renderActions(SUSPENDED_ADMIN);

    choose("Reinstate");
    fireEvent.click(confirm("Reinstate"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't reinstate this account. Nothing was changed.",
    );
  });
});
