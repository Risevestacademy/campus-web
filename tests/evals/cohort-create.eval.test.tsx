import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

import { CohortCatalogue } from "@/features/admin";
import { toast, Toaster } from "@/shared/ui/toast";
import {
  fillNewCohort,
  type NewCohortInput,
  openCreateCohort,
  submitNewCohort,
} from "@/tests/fixtures/cohorts";
import { type Reply, TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const navigations = vi.hoisted(() => [] as string[]);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => navigations.push(`push ${href}`),
    refresh: () => navigations.push("refresh"),
  }),
}));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/core/analytics/client", () => ({
  captureBrowserAnalyticsEvent: () => {},
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => navigations.push(`go ${href}`),
}));

const API_ORIGIN = "https://api.example.test";
const LIST_URL = `${API_ORIGIN}/v1/cohorts`;
const CREATE_URL = `${TEST_ORIGIN}/api/v1/cohorts`;
const CREATED = "Cohort created";

const VALID: NewCohortInput = { name: "Cohort 1", code: "c1" };

const json =
  (body: unknown, status: number): Reply =>
  () =>
    Response.json(body, { status });
const failure = (status: number, code: string): Reply =>
  json({ error: { code, message: "scripted" } }, status);

function listPage(page: number) {
  return {
    items: [],
    meta: { page, perPage: 20, total: 0, totalPages: 0 },
  };
}

const creates = () =>
  mockApi.requests.filter(
    ({ method, url }) => method === "POST" && url === CREATE_URL,
  );

// Navigation first: a full load or route change replaces whatever else shows.
function describeScreen(): string {
  const open =
    screen.queryByRole("dialog", { name: "Create a cohort" }) !== null;
  if (screen.queryAllByText(CREATED).length > 0) {
    return `${open ? "open" : "closed"} + toast: ${CREATED} + ${navigations.join(",")}`;
  }
  if (navigations.length > 0) return navigations.join(",");
  const errors = screen
    .queryAllByRole("alert")
    .map((alert) => alert.textContent)
    .filter(Boolean);
  return errors.length > 0 ? `errors: ${errors.join(" | ")}` : "nothing";
}

async function observeCreate(
  reply: Reply,
  input: NewCohortInput,
  page: number,
): Promise<string> {
  mockApi.server.use(
    http.get(LIST_URL, json(listPage(page), 200)),
    http.post(CREATE_URL, reply),
  );
  render(
    <>
      {withQueryClient(await CohortCatalogue({ page: String(page) }))}
      <Toaster />
    </>,
  );
  await openCreateCohort();

  fillNewCohort(input);
  submitNewCohort();
  submitNewCohort();

  await waitFor(() => expect(describeScreen()).not.toBe("nothing"));
  if (creates().length > 0) {
    await waitFor(() => expect(screen.queryByText("Creating…")).toBeNull());
  }
  // The popup unmounts after its exit transition; a dialog that never closes
  // is reported as "open" rather than failing the whole run.
  if (screen.queryAllByText(CREATED).length > 0) {
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Create a cohort" }),
      ).toBeNull(),
    ).catch(() => undefined);
  }

  const seen = describeScreen();
  const posts = creates().length;
  return posts <= 1
    ? `${seen} (${posts} POST)`
    : `${seen} after ${posts} POSTs`;
}

function settleRun() {
  cleanup();
  toast.close();
  mockApi.reset();
  navigations.length = 0;
}

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", API_ORIGIN);
});

afterEach(() => {
  settleRun();
  vi.unstubAllEnvs();
});

afterAll(() => {
  mockApi.close();
});

interface Expectation {
  name: string;
  reply: Reply;
  expected: string;
  input?: NewCohortInput;
  page?: number;
}

const OUTAGE =
  "errors: We couldn't create the cohort. Nothing was saved. Check your connection and try again. (1 POST)";
const created = json({}, 201);

const ANSWERS: Expectation[] = [
  {
    name: "201 on page 1",
    reply: created,
    expected: `closed + toast: ${CREATED} + refresh (1 POST)`,
  },
  {
    name: "201 on page 2",
    reply: created,
    page: 2,
    expected: `closed + toast: ${CREATED} + push /campus (1 POST)`,
  },
  {
    name: "400",
    reply: failure(400, "VALIDATION_FAILED"),
    expected:
      "errors: campus-api rejected these details. Check the dates and try again. (1 POST)",
  },
  {
    name: "401",
    reply: failure(401, "UNAUTHORIZED"),
    expected: "go /sign-in (1 POST)",
  },
  {
    name: "403",
    reply: failure(403, "FORBIDDEN"),
    expected:
      "errors: You no longer have permission to create Cohorts. (1 POST)",
  },
  {
    name: "409",
    reply: failure(409, "CONFLICT"),
    expected: "errors: Another cohort already uses this code. (1 POST)",
  },
  { name: "500", reply: failure(500, "INTERNAL_ERROR"), expected: OUTAGE },
  {
    name: "network failure",
    reply: () => HttpResponse.error(),
    expected: OUTAGE,
  },
  {
    name: "blank fields",
    reply: created,
    input: {},
    expected: "errors: Enter a cohort name. | Enter a cohort code. (0 POST)",
  },
  {
    name: "end before start",
    reply: created,
    input: { ...VALID, startDate: "2026-09-02", endDate: "2026-09-01" },
    expected: "errors: End date must be on or after the start date. (0 POST)",
  },
];

// One test per answer: each gets its own time budget and names itself on failure.
describe("Cohort create eval (threshold: 0 mismatched outcomes, at most 1 POST per double-click, 0 POSTs for invalid input)", () => {
  it.each(ANSWERS)(
    "$name",
    async ({ reply, expected, input = VALID, page = 1 }) => {
      await expect(observeCreate(reply, input, page)).resolves.toBe(expected);
    },
  );
});
