import { render, screen, within } from "@testing-library/react";
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

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const FEEDBACK_URL = `${API_ORIGIN}/v1/feedback`;
const NOW = Date.parse("2026-10-16T12:00:00.000Z");

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("server-only", () => ({}));

import { CohortAdministrationOverview } from "./cohort-administration-overview";

const ada = { id: "u-1", email: "ada@campus.local", displayName: "Ada" };

function item(id: string, type: string, minutesAgo: number) {
  return {
    id,
    type,
    title: `Title ${id}`,
    about: null,
    status: "open",
    submittedBy: ada,
    reportedUser: null,
    createdAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
  };
}

type Open = Partial<Record<"report" | "bug" | "idea", [number, ...unknown[]]>>;

// Each kind: [total open, ...items newest first]. A kind left out has none.
function useOpenFeedback(open: Open) {
  mockApi.server.use(
    http.get(FEEDBACK_URL, ({ request }) => {
      const query = new URL(request.url).searchParams;
      const type = query.get("type") as keyof Open;
      expect(query.get("status")).toBe("open");
      expect(query.get("perPage")).toBe("1");
      const [total, ...items] = open[type] ?? [0];
      return Response.json({
        items: items.slice(0, 1),
        meta: { page: 1, perPage: 1, total, totalPages: total },
      });
    }),
  );
}

async function renderOverview(adminName?: string | null) {
  vi.stubEnv("API_BASE_URL", API_ORIGIN);
  render(await CohortAdministrationOverview({ cohortId: "c-1", adminName }));
}

const ALL_KINDS: Open = {
  report: [3, item("r1", "report", 12), item("r2", "report", 90)],
  bug: [3, item("b1", "bug", 60)],
  idea: [1, item("i1", "idea", 24 * 60 * 2)],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  mockApi.reset();
  vi.unstubAllEnvs();
});
afterAll(() => mockApi.close());

describe("CohortAdministrationOverview", () => {
  it("greets the administrator by first name", async () => {
    useOpenFeedback(ALL_KINDS);
    await renderOverview("Jerry Okafor");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /^(Good morning|Good afternoon|Good evening), Jerry$/,
      }),
    ).toBeVisible();
  });

  it("greets without a name when the account has none", async () => {
    useOpenFeedback(ALL_KINDS);
    await renderOverview(null);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /^(Good morning|Good afternoon|Good evening)$/,
      }),
    ).toBeVisible();
  });

  it("shows the four headline figures without trend comparisons", async () => {
    useOpenFeedback(ALL_KINDS);
    await renderOverview("Jerry");

    for (const label of [
      "Online now",
      "Live now",
      "Attendance",
      "Needs review",
    ]) {
      expect(screen.getByText(label)).toBeVisible();
    }
    expect(screen.queryByText(/vs last/)).not.toBeInTheDocument();
  });

  it("counts every open report, bug and idea under Needs review", async () => {
    useOpenFeedback(ALL_KINDS);
    await renderOverview("Jerry");

    const card = screen.getByText("Needs review").closest("li")!;

    expect(within(card).getByText("7")).toBeVisible();
    expect(within(card).getByText("Reports: 3 · Feedback: 4")).toBeVisible();
  });

  it("shows zero when nothing is open", async () => {
    useOpenFeedback({});
    await renderOverview("Jerry");

    const card = screen.getByText("Needs review").closest("li")!;

    expect(within(card).getByText("0")).toBeVisible();
    expect(within(card).getByText("Reports: 0 · Feedback: 0")).toBeVisible();
  });

  it("shows dashes rather than wrong numbers when feedback can't be read", async () => {
    mockApi.server.use(
      http.get(FEEDBACK_URL, () => new Response(null, { status: 500 })),
    );
    await renderOverview("Jerry");

    const card = screen.getByText("Needs review").closest("li")!;

    expect(within(card).getByText("—")).toBeVisible();
    expect(within(card).getByText("Reports: — · Feedback: —")).toBeVisible();
    expect(
      screen.getByText("We couldn't load feedback right now."),
    ).toBeVisible();
  });

  it("lists the latest open report, bug and idea in that order", async () => {
    useOpenFeedback(ALL_KINDS);
    await renderOverview("Jerry");

    const attention = screen.getByRole("region", { name: "Needs attention" });
    const rows = within(attention).getAllByRole("listitem");

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Title r1");
    expect(rows[0]).toHaveTextContent("12 min ago");
    expect(within(rows[0]!).getByRole("img", { name: "Report" })).toBeVisible();
    expect(rows[1]).toHaveTextContent("Title b1");
    expect(rows[1]).toHaveTextContent("1 h ago");
    expect(within(rows[1]!).getByRole("img", { name: "Bug" })).toBeVisible();
    expect(rows[2]).toHaveTextContent("Title i1");
    expect(rows[2]).toHaveTextContent("2 d ago");
    expect(within(rows[2]!).getByRole("img", { name: "Idea" })).toBeVisible();
    expect(attention).not.toHaveTextContent("Title r2");
  });

  it("sends each Review button to that item on the Feedback & reports page", async () => {
    useOpenFeedback(ALL_KINDS);
    await renderOverview("Jerry");

    expect(
      screen.getByRole("link", { name: "Review Title r1" }),
    ).toHaveAttribute("href", "/campus/c-1/feedback?tab=reports&item=r1");
    expect(
      screen.getByRole("link", { name: "Review Title b1" }),
    ).toHaveAttribute("href", "/campus/c-1/feedback?item=b1");
    expect(
      screen.getByRole("link", { name: "Review Title i1" }),
    ).toHaveAttribute("href", "/campus/c-1/feedback?item=i1");
  });

  it("leaves out a kind with nothing open", async () => {
    useOpenFeedback({ bug: [1, item("b1", "bug", 5)] });
    await renderOverview("Jerry");

    const attention = screen.getByRole("region", { name: "Needs attention" });

    expect(within(attention).getAllByRole("listitem")).toHaveLength(1);
    expect(attention).toHaveTextContent("Title b1");
  });

  it("says so when nothing needs attention", async () => {
    useOpenFeedback({});
    await renderOverview("Jerry");

    const attention = screen.getByRole("region", { name: "Needs attention" });

    expect(
      within(attention).getByText("Nothing needs attention right now."),
    ).toBeVisible();
    expect(within(attention).queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("shows today's schedule", async () => {
    useOpenFeedback(ALL_KINDS);
    await renderOverview("Jerry");

    const today = screen.getByRole("region", { name: "Today" });
    expect(within(today).getAllByRole("listitem")).toHaveLength(4);
    expect(within(today).getByText("LIVE")).toBeVisible();
  });

  it("leaves out the campus analytics panels", async () => {
    useOpenFeedback(ALL_KINDS);
    await renderOverview("Jerry");

    for (const name of [
      "Campus right now",
      "Attendance and participation",
      "When campus is busiest",
      "Attendance by track",
    ]) {
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
  });

  it("links to the Active Campus and the Programme Tracks page", async () => {
    useOpenFeedback(ALL_KINDS);
    await renderOverview("Jerry");

    expect(screen.getByRole("link", { name: "Open campus" })).toHaveAttribute(
      "href",
      "/campus/c-1",
    );
    expect(
      screen.getByRole("link", { name: /Programme Tracks/ }),
    ).toHaveAttribute("href", "/campus/c-1/tracks");
  });
});
