import { render, screen } from "@testing-library/react";
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

import { withQueryClient } from "@/tests/fixtures/query-client";

import { AdministrationCatalogue } from "./administration-catalogue";

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

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", API_ORIGIN);
  mockApi.server.use(
    http.get(`${API_ORIGIN}/v1/cohorts`, () =>
      Response.json({
        items: [],
        meta: { page: 1, perPage: 12, total: 0, totalPages: 1 },
      }),
    ),
    http.get(`${API_ORIGIN}/v1/tracks`, () =>
      Response.json({
        items: [
          {
            id: "track-1",
            name: "Computer Science",
            code: "CSC",
            description: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        meta: { page: 2, perPage: 12, total: 13, totalPages: 2 },
      }),
    ),
  );
});
afterEach(() => {
  mockApi.reset();
  vi.unstubAllEnvs();
});
afterAll(() => mockApi.close());

describe("AdministrationCatalogue", () => {
  it("falls back to Cohorts page 1 for an invalid query", async () => {
    render(
      withQueryClient(
        await AdministrationCatalogue({ view: "unknown", page: "abc" }),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: /choose a cohort/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cohorts/i })).toHaveAttribute(
      "href",
      "/campus?view=cohorts&page=1",
    );
  });

  it("switches to Tracks while preserving the requested page", async () => {
    render(
      withQueryClient(
        await AdministrationCatalogue({ view: "tracks", page: "2" }),
      ),
    );
    expect(await screen.findByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cohorts/i })).toHaveAttribute(
      "href",
      "/campus?view=cohorts&page=1",
    );
  });
});
