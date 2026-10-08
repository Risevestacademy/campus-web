import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { toast, Toaster } from "@/shared/ui/toast";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import { CohortAdministrationCard } from "./cohort-administration-card";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const sideEffects = vi.hoisted(() => [] as string[]);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => sideEffects.push("refresh"),
  }),
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => sideEffects.push(`replace ${href}`),
}));

const cohort = {
  id: "cohort-1",
  name: "Cohort 1",
  code: "C1",
  startDate: "2026-09-01",
  endDate: "2027-06-30",
  status: "upcoming" as const,
};

const cohortUrl = `${TEST_ORIGIN}/api/v1/cohorts/cohort-1`;

function renderCard() {
  render(
    <>
      {withQueryClient(<CohortAdministrationCard cohort={cohort} />)}
      <Toaster />
    </>,
  );
}

async function openAction(action: "Edit" | "Delete") {
  fireEvent.click(screen.getByRole("button", { name: "Manage Cohort 1" }));
  const menu = await screen.findByRole("menu");
  fireEvent.click(within(menu).getByRole("menuitem", { name: action }));
}

const mutations = () =>
  mockApi.requests.filter(
    ({ method }) => method === "PATCH" || method === "DELETE",
  );

afterEach(() => {
  cleanup();
  toast.close();
  mockApi.reset();
  sideEffects.length = 0;
});

afterAll(() => {
  mockApi.close();
});

describe("CohortAdministrationCard", () => {
  it("keeps Active Campus as the primary destination", () => {
    renderCard();

    expect(screen.getByRole("link", { name: /Cohort 1/ })).toHaveAttribute(
      "href",
      "/campus/cohort-1",
    );
    expect(
      screen.getByRole("button", { name: "Manage Cohort 1" }),
    ).toBeInTheDocument();
  });

  it("PATCHes normalized changed fields once, then closes and refreshes", async () => {
    const bodies: unknown[] = [];
    mockApi.server.use(
      http.patch(cohortUrl, async ({ request }) => {
        bodies.push(await request.json());
        return Response.json({ ...cohort, name: "Renamed", code: "C2" });
      }),
    );
    renderCard();
    await openAction("Edit");

    const dialog = await screen.findByRole("dialog", {
      name: "Edit Cohort 1",
    });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: " Renamed " },
    });
    fireEvent.change(within(dialog).getByLabelText("Code"), {
      target: { value: " c2 " },
    });
    fireEvent.change(within(dialog).getByLabelText("End date"), {
      target: { value: "" },
    });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Active" }));

    const save = within(dialog).getByRole("button", { name: "Save changes" });
    act(() => {
      save.click();
      save.click();
    });

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies).toEqual([
      {
        name: "Renamed",
        code: "C2",
        endDate: null,
        status: "active",
      },
    ]);
    expect(await screen.findByText("Cohort updated")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Edit Cohort 1" }),
      ).not.toBeInTheDocument(),
    );
    expect(sideEffects).toEqual(["refresh"]);
  });

  it("keeps the edit dialog and entered value after a conflict", async () => {
    mockApi.server.use(
      http.patch(cohortUrl, () => new Response(null, { status: 409 })),
    );
    renderCard();
    await openAction("Edit");

    const dialog = await screen.findByRole("dialog", {
      name: "Edit Cohort 1",
    });
    fireEvent.change(within(dialog).getByLabelText("Code"), {
      target: { value: "duplicate" },
    });
    const save = within(dialog).getByRole("button", { name: "Save changes" });
    act(() => {
      save.click();
      save.click();
    });

    expect(
      await within(dialog).findByText("Another Cohort already uses this code."),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Code")).toHaveValue("duplicate");
    expect(mutations()).toHaveLength(1);
    expect(sideEffects).toEqual([]);
  });

  it("requires a named, permanent, non-cascading deletion confirmation", async () => {
    renderCard();
    await openAction("Delete");

    const dialog = await screen.findByRole("dialog", {
      name: "Delete Cohort 1?",
    });
    expect(dialog).toHaveTextContent("permanent");
    expect(dialog).toHaveTextContent("never cascades");
    expect(dialog).toHaveTextContent("Programme Tracks");
    expect(mutations()).toHaveLength(0);
  });

  it("closes, confirms, and refreshes after deletion", async () => {
    mockApi.server.use(
      http.delete(cohortUrl, () => new Response(null, { status: 204 })),
    );
    renderCard();
    await openAction("Delete");

    fireEvent.click(screen.getByRole("button", { name: "Delete cohort" }));

    expect(await screen.findByText("Cohort deleted")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Delete Cohort 1?" }),
      ).not.toBeInTheDocument(),
    );
    expect(mutations()).toHaveLength(1);
    expect(sideEffects).toEqual(["refresh"]);
  });

  it("keeps a conflicted deletion open and never attempts a cascade", async () => {
    mockApi.server.use(
      http.delete(cohortUrl, () => new Response(null, { status: 409 })),
    );
    renderCard();
    await openAction("Delete");

    const dialog = await screen.findByRole("dialog", {
      name: "Delete Cohort 1?",
    });
    const remove = within(dialog).getByRole("button", {
      name: "Delete cohort",
    });
    act(() => {
      remove.click();
      remove.click();
    });

    expect(
      await within(dialog).findByText(/still has Programme Tracks/),
    ).toBeInTheDocument();
    expect(mutations().map(({ method, url }) => [method, url])).toEqual([
      ["DELETE", cohortUrl],
    ]);
    expect(sideEffects).toEqual([]);
  });
});
