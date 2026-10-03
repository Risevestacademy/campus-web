import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { toast, Toaster } from "@/shared/ui/toast";
import {
  fillNewCohort,
  openCreateCohort,
  submitNewCohort,
} from "@/tests/fixtures/cohorts";
import { type Reply, TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import { CreateCohortTile } from "./create-cohort-tile";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const sideEffects = vi.hoisted(() => [] as string[]);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => sideEffects.push(`push ${href}`),
    refresh: () => sideEffects.push("refresh"),
  }),
}));
vi.mock("@/core/analytics/client", () => ({
  captureBrowserAnalyticsEvent: (name: string, properties: object) => {
    sideEffects.push(`capture ${name} ${JSON.stringify(properties)}`);
  },
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => sideEffects.push(`replace ${href}`),
}));

const CREATE_URL = `${TEST_ORIGIN}/api/v1/cohorts`;
const created: Reply = () => Response.json({}, { status: 201 });
const neverAnswers: Reply = () => new Promise<Response>(() => {});

function backendAnswers(reply: Reply) {
  const bodies: unknown[] = [];
  mockApi.server.use(
    http.post(CREATE_URL, async ({ request }) => {
      bodies.push(await request.json());
      return reply();
    }),
  );
  return bodies;
}

function renderTile(page = 1) {
  render(
    <>
      {withQueryClient(<CreateCohortTile page={page} />)}
      <Toaster />
    </>,
  );
}

const dialogIsOpen = () =>
  screen.queryByRole("dialog", { name: "Create a cohort" }) !== null;

afterEach(() => {
  cleanup();
  toast.close();
  mockApi.reset();
  sideEffects.length = 0;
});

afterAll(() => {
  mockApi.close();
});

describe("CreateCohortTile", () => {
  it("opens a create dialog with Upcoming chosen", async () => {
    renderTile();

    const dialog = await openCreateCohort();

    expect(dialog.getByRole("radio", { name: "Upcoming" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(dialog.getByLabelText("Name")).toHaveValue("");
  });

  it("sends the trimmed, uppercased cohort with the chosen status and dates", async () => {
    const bodies = backendAnswers(created);
    renderTile();
    await openCreateCohort();

    fillNewCohort({
      name: " Cohort 1 ",
      code: "c1",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      status: "Active",
    });
    submitNewCohort();

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies).toEqual([
      {
        name: "Cohort 1",
        code: "C1",
        startDate: "2026-09-01",
        endDate: "2027-06-30",
        status: "active",
      },
    ]);
  });

  it("closes, confirms and records cohort.created once", async () => {
    backendAnswers(created);
    renderTile();
    await openCreateCohort();

    fillNewCohort({ name: "Cohort 1", code: "C1" });
    submitNewCohort();

    expect(await screen.findByText("Cohort created")).toBeInTheDocument();
    await waitFor(() => expect(dialogIsOpen()).toBe(false));
    expect(sideEffects).toEqual([
      'capture cohort.created {"cohort_status":"upcoming"}',
      "refresh",
    ]);
  });

  it("stays open while the request is in flight", async () => {
    backendAnswers(neverAnswers);
    renderTile();
    const dialog = await openCreateCohort();

    fillNewCohort({ name: "Cohort 1", code: "C1" });
    submitNewCohort();

    const pending = await dialog.findByRole("button", { name: "Creating…" });
    expect(pending).toBeDisabled();
    expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));

    expect(dialogIsOpen()).toBe(true);
  });

  it("starts empty again after Cancel", async () => {
    renderTile();
    const dialog = await openCreateCohort();
    fillNewCohort({ name: "Draft" });

    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(dialogIsOpen()).toBe(false));

    const reopened = await openCreateCohort();
    expect(reopened.getByLabelText("Name")).toHaveValue("");
  });
});
