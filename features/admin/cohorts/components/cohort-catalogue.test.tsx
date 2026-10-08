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

import { withQueryClient } from "@/tests/fixtures/query-client";

import { CohortCatalogue } from "../../index";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("server-only", () => ({}));

const API_ORIGIN = "https://api.example.test";
const COHORTS_URL = `${API_ORIGIN}/v1/cohorts`;

function cohortsPage(page: number, totalPages: number, names: string[]) {
  return {
    items: names.map((name) => ({
      id: `id-${name}`,
      name,
      code: name.toUpperCase(),
      startDate: null,
      endDate: null,
      status: "active",
      createdAt: "2026-09-22T12:00:00.000Z",
      updatedAt: "2026-09-22T12:00:00.000Z",
    })),
    meta: { page, perPage: 20, total: totalPages * 20, totalPages },
  };
}

function backendPages(...pages: ReturnType<typeof cohortsPage>[]) {
  mockApi.server.use(
    http.get(COHORTS_URL, ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get("page"));
      const reply = pages.find((candidate) => candidate.meta.page === page);
      return reply ? Response.json(reply) : new Response(null, { status: 404 });
    }),
  );
  return mockApi.requests;
}

async function renderCatalogue(page?: string) {
  render(withQueryClient(await CohortCatalogue({ page })));
}

function cohortLinks() {
  return screen
    .getAllByRole("link")
    .filter((link) => /^\/campus\/[^?]+$/.test(link.getAttribute("href") ?? ""))
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", API_ORIGIN);
});

afterEach(() => {
  mockApi.reset();
  vi.unstubAllEnvs();
});

afterAll(() => {
  mockApi.close();
});

describe("CohortCatalogue", () => {
  it("offers the requested page of every Cohort", async () => {
    const sent = backendPages(cohortsPage(2, 3, ["Gamma", "Delta"]));

    await renderCatalogue("2");

    expect(cohortLinks()).toEqual([
      ["GammaGAMMA", "/campus/id-Gamma"],
      ["DeltaDELTA", "/campus/id-Delta"],
    ]);
    expect(sent.map((request) => request.url)).toEqual([
      `${COHORTS_URL}?page=2`,
    ]);
  });

  it("asks for page 1 when the page number is invalid", async () => {
    const sent = backendPages(cohortsPage(1, 1, ["Alpha"]));

    await renderCatalogue("abc");

    expect(sent.map((request) => request.url)).toEqual([
      `${COHORTS_URL}?page=1`,
    ]);
  });

  it.each([
    [1, 3, [], ["Next page", "/campus?view=cohorts&page=2"]],
    [
      2,
      3,
      ["Previous page", "/campus?view=cohorts&page=1"],
      ["Next page", "/campus?view=cohorts&page=3"],
    ],
    [3, 3, ["Previous page", "/campus?view=cohorts&page=2"], []],
  ])(
    "links page %i of %i to its neighbours",
    async (page, totalPages, previous, next) => {
      backendPages(cohortsPage(page, totalPages, ["Alpha"]));

      await renderCatalogue(String(page));

      const pages = screen.getByRole("navigation", { name: "Cohort pages" });
      expect(within(pages).getByText(`Page ${page} of ${totalPages}`));
      expect(
        within(pages)
          .queryAllByRole("link")
          .map((link) => [link.textContent, link.getAttribute("href")]),
      ).toEqual([previous, next].filter((link) => link.length > 0));
    },
  );

  it("hides pagination when everything fits on one page", async () => {
    backendPages(cohortsPage(1, 1, ["Alpha"]));

    await renderCatalogue();

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("puts the create tile before the Cohorts on every page", async () => {
    backendPages(cohortsPage(2, 3, ["Gamma", "Delta"]));

    await renderCatalogue("2");

    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["Create cohort", "GammaGAMMA", "DeltaDELTA"]);
  });

  it("explains the empty state next to the create tile", async () => {
    backendPages(cohortsPage(1, 0, []));

    await renderCatalogue();

    expect(
      screen.getByText(
        "No cohorts yet. Create the first one, then add its tracks before inviting students.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["Create cohort"]);
  });

  it("fails closed with a retry of the same page when campus-api is down", async () => {
    backendPages();

    await renderCatalogue("2");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load the cohorts",
    );
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/campus?view=cohorts&page=2",
    );
    expect(
      screen.queryByRole("button", { name: "Create cohort" }),
    ).not.toBeInTheDocument();
  });
});
