import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { withQueryClient } from "@/tests/fixtures/query-client";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const FEEDBACK_URL = `${API_ORIGIN}/v1/feedback`;

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { FeedbackAdministration } from "./feedback-administration";

const ada = {
  id: "u-1",
  email: "ada@campus.local",
  displayName: "Ada Lovelace",
};
const sodiq = { id: "u-2", email: "sodiq@campus.local", displayName: null };

const R1 = "0b9a6a52-6ad8-4c1a-9f0a-2a0d6a7b8c11";

function summary(
  id: string,
  type: "bug" | "idea" | "report",
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    type,
    title: `Title ${id}`,
    about: null,
    status: "open",
    submittedBy: ada,
    reportedUser: null,
    createdAt: "2026-10-12T09:30:00.000Z",
    ...extra,
  };
}

function record(id: string, type: "bug" | "idea" | "report", extra = {}) {
  return {
    ...summary(id, type),
    details: `Details for ${id}`,
    cohortId: null,
    context: null,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
    resolvedBy: null,
    resolvedAt: null,
    ...extra,
  };
}

function listReply(items: unknown[], total = items.length) {
  return Response.json({
    items,
    meta: { page: 1, perPage: 20, total, totalPages: 1 },
  });
}

function useFeedbackApi({
  bugs = [] as unknown[],
  ideas = [] as unknown[],
  reports = [] as unknown[],
  detail,
}: {
  bugs?: unknown[];
  ideas?: unknown[];
  reports?: unknown[];
  detail?: unknown;
} = {}) {
  mockApi.server.use(
    http.get(FEEDBACK_URL, ({ request }) => {
      const query = new URL(request.url).searchParams;
      const source = { bug: bugs, idea: ideas, report: reports }[
        query.get("type") ?? "bug"
      ] as { status: string }[];
      const status = query.get("status");
      const items = status
        ? source.filter((item) => item.status === status)
        : source;
      return listReply(items);
    }),
    http.get(`${FEEDBACK_URL}/:id`, () =>
      detail ? HttpResponse.json(detail) : new Response(null, { status: 404 }),
    ),
  );
}

async function renderPage(
  rawQuery: Parameters<typeof FeedbackAdministration>[0]["rawQuery"] = {},
) {
  vi.stubEnv("API_BASE_URL", API_ORIGIN);
  render(
    withQueryClient(
      await FeedbackAdministration({ cohortId: "c-1", rawQuery }),
    ),
  );
}

afterEach(() => {
  mockApi.reset();
  vi.unstubAllEnvs();
});
afterAll(() => mockApi.close());

describe("FeedbackAdministration", () => {
  it("shows bugs and ideas newest first with the first one open in detail", async () => {
    useFeedbackApi({
      bugs: [summary("b1", "bug", { createdAt: "2026-10-12T10:00:00.000Z" })],
      ideas: [summary("i1", "idea", { createdAt: "2026-10-11T10:00:00.000Z" })],
      detail: record("b1", "bug"),
    });

    await renderPage();

    const queue = screen.getByRole("region", { name: "Feedback" });
    const links = within(queue).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining("Title b1"),
      expect.stringContaining("Title i1"),
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("heading", { level: 2, name: "Title b1" }),
    ).toBeVisible();
    expect(screen.getByText("Details for b1")).toBeVisible();
    expect(screen.queryByText("Device")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark as resolved" }),
    ).toBeVisible();
  });

  it("counts both tabs and the filters", async () => {
    useFeedbackApi({
      bugs: [
        summary("b1", "bug"),
        summary("b2", "bug", { status: "resolved" }),
      ],
      ideas: [summary("i1", "idea")],
      reports: [summary("r1", "report")],
      detail: record("b1", "bug"),
    });

    await renderPage();

    const tabs = screen.getByRole("navigation", { name: "Feedback sections" });
    expect(
      within(tabs).getByRole("link", { name: /Feedback/ }),
    ).toHaveTextContent("3");
    expect(
      within(tabs).getByRole("link", { name: /Reports/ }),
    ).toHaveTextContent("1");

    const filters = screen.getByRole("navigation", { name: "Filter" });
    expect(
      within(filters).getByRole("link", { name: "All 3" }),
    ).toHaveAttribute("aria-current", "true");
    expect(within(filters).getByRole("link", { name: "Open 2" })).toBeVisible();
    expect(
      within(filters).getByRole("link", { name: "Resolved 1" }),
    ).toBeVisible();
    expect(within(filters).getByRole("link", { name: "Bugs 2" })).toBeVisible();
    expect(
      within(filters).getByRole("link", { name: "Ideas 1" }),
    ).toBeVisible();
  });

  it("offers Reopen for a resolved item and names who resolved it", async () => {
    useFeedbackApi({
      bugs: [summary("b1", "bug", { status: "resolved" })],
      detail: record("b1", "bug", {
        status: "resolved",
        resolvedBy: sodiq,
        resolvedAt: "2026-10-12T10:00:00.000Z",
      }),
    });

    await renderPage();

    expect(screen.getByRole("button", { name: "Reopen" })).toBeVisible();
    expect(screen.getByText(/Resolved by sodiq@campus.local/)).toBeVisible();
  });

  it("lists a report that picked a person by the account and keeps the place", async () => {
    useFeedbackApi({
      reports: [
        summary("r1", "report", {
          about: "Main hallway",
          reportedUser: {
            id: "u-9",
            email: "bola@campus.local",
            displayName: "Bola Ade",
          },
        }),
      ],
    });

    await renderPage({ tab: "reports" });

    const row = within(
      screen.getByRole("table", { name: "Reports" }),
    ).getAllByRole("row")[1]!;
    expect(within(row).getByText("Bola Ade")).toBeVisible();
    expect(within(row).getByText("Main hallway")).toBeVisible();
    expect(within(row).queryByText("Not named")).not.toBeInTheDocument();
  });

  it("lists reports with who was reported and links to review them", async () => {
    useFeedbackApi({
      reports: [
        summary("r1", "report", {
          about: "Main hallway",
          reportedUser: {
            id: "u-9",
            email: "sodiq@campus.local",
            displayName: "Sodiq Semiu",
          },
        }),
        summary("r2", "report"),
      ],
    });

    await renderPage({ tab: "reports" });

    const table = screen.getByRole("table", { name: "Reports" });
    const rows = within(table).getAllByRole("row");

    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText("Sodiq Semiu")).toBeVisible();
    expect(within(rows[1]!).getByText("Main hallway")).toBeVisible();
    expect(within(rows[1]!).getByText("Title r1")).toBeVisible();
    expect(table.querySelector("svg")).toBeNull();
    expect(within(rows[2]!).getByText("Not named")).toBeVisible();
    expect(
      within(rows[1]!).getByRole("link", { name: "Review Title r1" }),
    ).toHaveAttribute("href", "/campus/c-1/feedback?tab=reports&item=r1");
    expect(screen.getByText(/Reporters stay anonymous/)).toBeVisible();
  });

  it("shows the selected report's detail below the table without a Report pill", async () => {
    useFeedbackApi({
      reports: [summary(R1, "report")],
      detail: record(R1, "report", {
        about: "Main hallway",
        reportedUser: {
          id: "u-9",
          email: "sodiq@campus.local",
          displayName: "Sodiq Semiu",
        },
      }),
    });

    await renderPage({ tab: "reports", item: R1 });

    expect(
      screen.getByRole("heading", { level: 2, name: `Title ${R1}` }),
    ).toBeVisible();
    const detail = screen.getByRole("article");
    expect(within(detail).getByText("Open")).toBeVisible();
    expect(within(detail).queryByText("Report")).not.toBeInTheDocument();
    expect(within(detail).getByText("Sodiq Semiu")).toBeVisible();
    expect(within(detail).getByText("Main hallway")).toBeVisible();
    expect(within(detail).queryByText("Device")).not.toBeInTheDocument();
  });

  it("explains an empty queue and an unavailable one", async () => {
    useFeedbackApi();
    await renderPage();
    expect(screen.getByText("No feedback here yet.")).toBeVisible();
  });

  it("offers a retry when the backend is unavailable", async () => {
    mockApi.server.use(
      http.get(FEEDBACK_URL, () => new Response(null, { status: 500 })),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load feedback.",
    );
    expect(screen.getByRole("link", { name: "Try again" })).toBeVisible();
  });
});
