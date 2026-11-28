import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { http } from "msw";
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

// Every backend answer for these mutations is replayed in
// admin-mutations.eval.test.tsx. This eval checks what each request sends.
describe("Change system role request eval (threshold: 0 extra fields; exactly 1 request per double click)", () => {
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
});

describe("Suspend request eval (threshold: 0 extra fields; 0 requests for an invalid reason)", () => {
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
});
