import { render, screen, within } from "@testing-library/react";
import { http } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import { CohortChooser, type CohortViewer } from "../index";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const API_ORIGIN = "https://api.example.test";
const COHORTS_URL = `${API_ORIGIN}/v1/cohorts`;
const api = createApiClient({ baseUrl: API_ORIGIN });

const member: CohortViewer = {
  user: { systemRole: "user" },
  memberships: [
    { cohortId: "c-3", cohort: { name: "Cohort 3", code: "C3" } },
    { cohortId: "c-4", cohort: { name: "Cohort 4", code: "C4" } },
  ],
};

const admin: CohortViewer = { user: { systemRole: "admin" }, memberships: [] };

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

async function renderChooser(viewer: CohortViewer, page?: string) {
  render(await CohortChooser({ viewer, page, api }));
}

function cohortLinks() {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("href")?.endsWith("/join"))
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

afterEach(() => {
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("CohortChooser: members", () => {
  it("offers each of the member's cohorts without asking campus-api", async () => {
    const sent = backendPages();

    await renderChooser(member);

    expect(cohortLinks()).toEqual([
      ["Cohort 3C3", "/campus/c-3/join"],
      ["Cohort 4C4", "/campus/c-4/join"],
    ]);
    expect(sent).toEqual([]);
  });

  it("ignores a page number", async () => {
    const sent = backendPages();

    await renderChooser(member, "3");

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(sent).toEqual([]);
  });
});

describe("CohortChooser: admins", () => {
  it("offers the requested page of every cohort", async () => {
    const sent = backendPages(cohortsPage(2, 3, ["Gamma", "Delta"]));

    await renderChooser(admin, "2");

    expect(cohortLinks()).toEqual([
      ["GammaGAMMA", "/campus/id-Gamma/join"],
      ["DeltaDELTA", "/campus/id-Delta/join"],
    ]);
    expect(sent.map((request) => request.url)).toEqual([
      `${COHORTS_URL}?page=2`,
    ]);
  });

  it("asks for page 1 when the page number is invalid", async () => {
    const sent = backendPages(cohortsPage(1, 1, ["Alpha"]));

    await renderChooser(admin, "abc");

    expect(sent.map((request) => request.url)).toEqual([
      `${COHORTS_URL}?page=1`,
    ]);
  });

  it.each([
    [1, 3, [], ["Next page", "/campus?page=2"]],
    [
      2,
      3,
      ["Previous page", "/campus?page=1"],
      ["Next page", "/campus?page=3"],
    ],
    [3, 3, ["Previous page", "/campus?page=2"], []],
  ])(
    "links page %i of %i to its neighbours",
    async (page, totalPages, previous, next) => {
      backendPages(cohortsPage(page, totalPages, ["Alpha"]));

      await renderChooser(admin, String(page));

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

    await renderChooser(admin);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("says so when there are no cohorts", async () => {
    backendPages(cohortsPage(1, 0, []));

    await renderChooser(admin);

    expect(screen.getByText("No cohorts to show.")).toBeInTheDocument();
  });

  it("fails closed with a retry of the same page when campus-api is down", async () => {
    backendPages();

    await renderChooser(admin, "2");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load the cohorts",
    );
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/campus?page=2",
    );
  });
});
