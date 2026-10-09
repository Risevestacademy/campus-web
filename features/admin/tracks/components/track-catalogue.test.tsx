import { render, screen } from "@testing-library/react";
import { http } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { withQueryClient } from "@/tests/fixtures/query-client";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { TrackCatalogue } from "./track-catalogue";

describe("TrackCatalogue", () => {
  it("uses contextual pagination links", async () => {
    vi.stubEnv("API_BASE_URL", API_ORIGIN);
    mockApi.server.use(
      http.get(`${API_ORIGIN}/v1/tracks`, () =>
        Response.json({
          items: [],
          meta: { page: 2, perPage: 12, total: 13, totalPages: 2 },
        }),
      ),
    );

    render(withQueryClient(await TrackCatalogue({ page: "2" })));

    expect(
      await screen.findByText(
        "No Programme Tracks yet. Create the first Programme Track.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute(
      "href",
      "/campus?view=tracks&page=1",
    );
  });
});

afterEach(() => {
  mockApi.reset();
  vi.unstubAllEnvs();
});
afterAll(() => mockApi.close());
