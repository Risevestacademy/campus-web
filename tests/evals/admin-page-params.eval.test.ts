import { render } from "@testing-library/react";
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

import { AdministrationCatalogue } from "@/features/admin";
import { parseAdministrationQuery } from "@/features/admin/catalogue/administration-query.schema";
import {
  parseFeedbackList,
  parseFeedbackRecord,
} from "@/features/admin/feedback/schemas/feedback.schema";
import { parseFeedbackQuery } from "@/features/admin/feedback/schemas/feedback-query.schema";
import {
  firstSearchParameter,
  parsePageNumber,
} from "@/shared/lib/search-params";
import { withQueryClient } from "@/tests/fixtures/query-client";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("server-only", () => ({}));

const API_ORIGIN = "https://api.example.test";
const EMPTY_PAGE = {
  items: [],
  meta: { page: 1, perPage: 12, total: 0, totalPages: 1 },
};

// Anything a person can type after ?page= reaches these parsers.
const HOSTILE_PAGES = [
  "0",
  "-1",
  "01",
  "1.5",
  "1e3",
  "0x10",
  "+1",
  " 2",
  "Infinity",
  "NaN",
  "١",
  "9007199254740992",
  "9".repeat(400),
  "__proto__",
];

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", API_ORIGIN);
  mockApi.server.use(
    http.get(`${API_ORIGIN}/v1/cohorts`, () => Response.json(EMPTY_PAGE)),
    http.get(`${API_ORIGIN}/v1/tracks`, () => Response.json(EMPTY_PAGE)),
  );
});
afterEach(() => {
  mockApi.reset();
  vi.unstubAllEnvs();
});
afterAll(() => mockApi.close());

describe("Admin page params eval (threshold: every case holds)", () => {
  describe("a URL can only ask for a real page", () => {
    it.each(HOSTILE_PAGES)("reads %j as page 1", (page) => {
      expect(parsePageNumber(page)).toBe(1);
    });

    it.each(HOSTILE_PAGES)(
      "resets the catalogue query for %j to Cohorts page 1",
      (page) => {
        expect(parseAdministrationQuery("tracks", page)).toEqual({
          view: "cohorts",
          page: 1,
        });
      },
    );

    it.each(HOSTILE_PAGES)(
      "resets the feedback query for page %j to page 1",
      (page) => {
        expect(parseFeedbackQuery({ page }).page).toBe(1);
      },
    );

    it.each(["", "../etc", "x".repeat(500), "00000000-0000", "__proto__"])(
      "drops the feedback item %j that is not an id",
      (item) => {
        expect(parseFeedbackQuery({ item }).itemId).toBeUndefined();
      },
    );

    it.each(["bug", "__proto__", "ALL", "open%20"])(
      "falls back to a known filter for %j on the reports tab",
      (filter) => {
        expect(parseFeedbackQuery({ tab: "reports", filter })).toMatchObject({
          tab: "reports",
          filter: "open",
        });
      },
    );

    it.each(["", "nope", "FEEDBACK", "__proto__", "reports ", "constructor"])(
      "reads the unknown feedback tab %j as the feedback tab",
      (tab) => {
        expect(parseFeedbackQuery({ tab })).toMatchObject({
          tab: "feedback",
          filter: "all",
        });
      },
    );

    it("reads only the first of a repeated feedback param", () => {
      const first = firstSearchParameter(["reports", "feedback"]);

      expect(first).toBe("reports");
      expect(
        parseFeedbackQuery({
          tab: firstSearchParameter(["nope", "reports"]),
          page: firstSearchParameter(["-3", "2"]),
          filter: firstSearchParameter([]),
        }),
      ).toMatchObject({ tab: "feedback", page: 1, filter: "all" });
    });

    it.each([
      null,
      "text",
      [],
      {},
      { items: "x", meta: {} },
      { items: [{}], meta: { page: 1, totalPages: 1, total: 1 } },
      { items: [], meta: { page: 0, totalPages: 1, total: 0 } },
      { items: [], meta: { page: 1.5, totalPages: 1, total: 0 } },
      { items: [], meta: { page: 1, totalPages: -1, total: 0 } },
    ])("treats the malformed feedback list %j as unavailable", (body) => {
      expect(parseFeedbackList(body)).toBeUndefined();
    });

    it.each([
      null,
      "text",
      [],
      {},
      { id: "f-1" },
      { id: "f-1", type: "praise", title: "x", status: "open" },
      { id: 1, type: "bug", title: "x", status: "open" },
    ])("treats the malformed feedback record %j as unavailable", (body) => {
      expect(parseFeedbackRecord(body)).toBeUndefined();
    });

    it("never requests a fractional page from campus-api", async () => {
      render(
        withQueryClient(
          await AdministrationCatalogue({ view: "tracks", page: "1.5" }),
        ),
      );

      expect(mockApi.requests.map((request) => request.url)).toEqual([
        `${API_ORIGIN}/v1/cohorts?page=1`,
      ]);
    });
  });
});
