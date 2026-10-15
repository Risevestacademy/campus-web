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
import { parsePageNumber } from "@/shared/lib/search-params";
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
