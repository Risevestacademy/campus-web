import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { CohortAdministrationCard } from "@/features/admin/cohorts/components/cohort-administration-card";
import {
  AttachCohortTrackForm,
  DetachCohortTrackDialog,
} from "@/features/admin/cohorts/components/cohort-track-actions";
import { CreateTrackTile } from "@/features/admin/tracks/components/create-track-tile";
import { TrackAdministrationCard } from "@/features/admin/tracks/components/track-administration-card";
import { toast, Toaster } from "@/shared/ui/toast";
import { type Reply, TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

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
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => sideEffects.push(`go ${href}`),
}));

const API = `${TEST_ORIGIN}/api/v1`;

const cohort = {
  id: "cohort-1",
  name: "Cohort 1",
  code: "C1",
  startDate: "2026-09-01",
  endDate: "2026-12-01",
  status: "upcoming" as const,
};
const track = {
  id: "track-1",
  name: "Computer Science",
  code: "CSC",
  description: "Details",
};

type Method = "post" | "patch" | "delete";

interface Mutation {
  name: string;
  method: Method;
  url: string;
  succeeded: string;
  render: () => ReactNode;
  doubleSubmit: () => Promise<void>;
  // Inline explanation per failing status; 0 stands for a network failure.
  explanations: Readonly<Record<number, string>>;
}

async function chooseMenuAction(owner: string, action: "Edit" | "Delete") {
  fireEvent.click(screen.getByRole("button", { name: `Manage ${owner}` }));
  const menu = await screen.findByRole("menu");
  fireEvent.click(within(menu).getByRole("menuitem", { name: action }));
}

async function clickTwice(dialogName: string, button: RegExp) {
  const dialog = await screen.findByRole("dialog", { name: dialogName });
  fireEvent.click(within(dialog).getByRole("button", { name: button }));
  fireEvent.click(within(dialog).getByRole("button", { name: button }));
}

async function renameAndSaveTwice(owner: string, name: string) {
  await chooseMenuAction(owner, "Edit");
  const dialog = await screen.findByRole("dialog", { name: `Edit ${owner}` });
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: name },
  });
  await clickTwice(`Edit ${owner}`, /^(Save changes|Saving…)$/);
}

const UNAVAILABLE_COHORT_EDIT =
  "We couldn't update this Cohort. Nothing was changed. Check your connection and try again.";
const UNAVAILABLE_COHORT_DELETE =
  "We couldn't delete this Cohort. Nothing was deleted. Check your connection and try again.";
const UNAVAILABLE_TRACK_CREATE =
  "We couldn't create this Programme Track. Check your connection and try again.";
const UNAVAILABLE_TRACK_EDIT =
  "We couldn't update this Programme Track. Check your connection and try again.";
const UNAVAILABLE_TRACK_DELETE =
  "We couldn't delete this Programme Track. Check your connection and try again.";
const UNAVAILABLE_ATTACH =
  "We couldn't attach this Programme Track. Try again.";
const UNAVAILABLE_DETACH =
  "We couldn't detach this Programme Track. Try again.";

const MUTATIONS: readonly Mutation[] = [
  {
    name: "Cohort edit",
    method: "patch",
    url: `${API}/cohorts/cohort-1`,
    succeeded: "Cohort updated",
    render: () => <CohortAdministrationCard cohort={cohort} />,
    doubleSubmit: () => renameAndSaveTwice(cohort.name, "Cohort One"),
    explanations: {
      400: "campus-api rejected these changes. Review the fields and try again.",
      403: "You no longer have permission to edit Cohorts.",
      404: "This Cohort no longer exists. Refresh the catalogue.",
      409: "Another Cohort already uses this code.",
      500: UNAVAILABLE_COHORT_EDIT,
      0: UNAVAILABLE_COHORT_EDIT,
    },
  },
  {
    name: "Cohort delete",
    method: "delete",
    url: `${API}/cohorts/cohort-1`,
    succeeded: "Cohort deleted",
    render: () => <CohortAdministrationCard cohort={cohort} />,
    doubleSubmit: async () => {
      await chooseMenuAction(cohort.name, "Delete");
      await clickTwice(`Delete ${cohort.name}?`, /^(Delete cohort|Deleting…)$/);
    },
    explanations: {
      400: "The Cohort identifier is invalid.",
      403: "You no longer have permission to delete Cohorts.",
      404: "This Cohort no longer exists. Refresh the catalogue.",
      409: "This Cohort still has Programme Tracks, members, or Invitations. Remove those associations before deleting it.",
      500: UNAVAILABLE_COHORT_DELETE,
      0: UNAVAILABLE_COHORT_DELETE,
    },
  },
  {
    name: "Programme Track create",
    method: "post",
    url: `${API}/tracks`,
    succeeded: "Programme Track created",
    render: () => <CreateTrackTile />,
    doubleSubmit: async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Create Programme Track" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "Create a Programme Track",
      });
      fireEvent.change(within(dialog).getByLabelText("Name"), {
        target: { value: "Data Science" },
      });
      fireEvent.change(within(dialog).getByLabelText("Code"), {
        target: { value: "dsc" },
      });
      await clickTwice(
        "Create a Programme Track",
        /^(Create programme track|Creating…)$/,
      );
    },
    explanations: {
      400: "campus-api rejected these details. Review the fields and try again.",
      403: "You no longer have permission to create Programme Tracks.",
      409: "Another Programme Track already uses this code.",
      500: UNAVAILABLE_TRACK_CREATE,
      0: UNAVAILABLE_TRACK_CREATE,
    },
  },
  {
    name: "Programme Track edit",
    method: "patch",
    url: `${API}/tracks/track-1`,
    succeeded: "Programme Track updated",
    render: () => <TrackAdministrationCard track={track} />,
    doubleSubmit: () => renameAndSaveTwice(track.name, "Data Science"),
    explanations: {
      400: "campus-api rejected these changes. Review the fields and try again.",
      403: "You no longer have permission to edit Programme Tracks.",
      404: "This Programme Track no longer exists. Refresh the catalogue.",
      409: "Another Programme Track already uses this code.",
      500: UNAVAILABLE_TRACK_EDIT,
      0: UNAVAILABLE_TRACK_EDIT,
    },
  },
  {
    name: "Programme Track delete",
    method: "delete",
    url: `${API}/tracks/track-1`,
    succeeded: "Programme Track deleted",
    render: () => <TrackAdministrationCard track={track} />,
    doubleSubmit: async () => {
      await chooseMenuAction(track.name, "Delete");
      await clickTwice(
        `Delete ${track.name}?`,
        /^(Delete programme track|Deleting…)$/,
      );
    },
    explanations: {
      400: "The Programme Track identifier is invalid.",
      403: "You no longer have permission to delete Programme Tracks.",
      404: "This Programme Track no longer exists. Refresh the catalogue.",
      409: "This Programme Track is still attached to a Cohort and cannot be deleted.",
      500: UNAVAILABLE_TRACK_DELETE,
      0: UNAVAILABLE_TRACK_DELETE,
    },
  },
  {
    name: "Cohort Track attach",
    method: "post",
    url: `${API}/cohorts/cohort-1/tracks`,
    succeeded: "Programme Track attached",
    render: () => (
      <AttachCohortTrackForm cohortId={cohort.id} tracks={[track]} />
    ),
    doubleSubmit: async () => {
      fireEvent.change(screen.getByLabelText("Programme Track"), {
        target: { value: track.id },
      });
      const attach = /^(Attach track|Attaching…)$/;
      fireEvent.click(screen.getByRole("button", { name: attach }));
      fireEvent.click(screen.getByRole("button", { name: attach }));
    },
    explanations: {
      400: "The Cohort or Programme Track identifier is invalid.",
      403: "You no longer have permission to attach Programme Tracks.",
      404: "The Cohort or Programme Track no longer exists.",
      409: "This Programme Track is already attached.",
      500: UNAVAILABLE_ATTACH,
      0: UNAVAILABLE_ATTACH,
    },
  },
  {
    name: "Cohort Track detach",
    method: "delete",
    url: `${API}/cohorts/cohort-1/tracks/track-1`,
    succeeded: "Programme Track detached",
    render: () => (
      <DetachCohortTrackDialog cohortId={cohort.id} track={track} />
    ),
    doubleSubmit: async () => {
      fireEvent.click(
        screen.getByRole("button", { name: `Detach ${track.name}` }),
      );
      await clickTwice(`Detach ${track.name}?`, /^(Detach track|Detaching…)$/);
    },
    explanations: {
      400: "The Cohort or Programme Track identifier is invalid.",
      403: "You no longer have permission to detach Programme Tracks.",
      404: "This Cohort Track association no longer exists.",
      409: "Students or Invitations still reference this Programme Track. Move or remove those references before detaching it.",
      500: UNAVAILABLE_DETACH,
      0: UNAVAILABLE_DETACH,
    },
  },
];

const SUCCESS_STATUS: Readonly<Record<Method, number>> = {
  post: 201,
  patch: 200,
  delete: 204,
};

function replyWith(status: number): Reply {
  if (status === 0) return () => HttpResponse.error();
  return () =>
    status === 204
      ? new Response(null, { status })
      : Response.json({ error: { code: "SCRIPTED" } }, { status });
}

function describeScreen(succeeded: string): string {
  const effects = sideEffects.join(",");
  if (screen.queryAllByText(succeeded).length > 0) return `toast + ${effects}`;
  if (effects) return effects;
  const alerts = screen
    .queryAllByRole("alert")
    .map((alert) => alert.textContent)
    .filter(Boolean);
  return alerts.length > 0 ? `alert: ${alerts.join(" | ")}` : "nothing";
}

function describeRequests({ method, url }: Mutation): string {
  const browserRequests = mockApi.requests.filter((request) =>
    request.url.startsWith(`${TEST_ORIGIN}/api/`),
  );
  const unexpected = browserRequests.filter(
    (request) => request.method !== method.toUpperCase() || request.url !== url,
  );
  if (unexpected.length > 0) {
    return unexpected
      .map((request) => `${request.method} ${request.url}`)
      .join(", ");
  }
  return `${browserRequests.length} request`;
}

async function observe(mutation: Mutation, status: number): Promise<string> {
  mockApi.server.use(http[mutation.method](mutation.url, replyWith(status)));
  render(
    <>
      {withQueryClient(mutation.render())}
      <Toaster />
    </>,
  );

  await mutation.doubleSubmit();
  await waitFor(() =>
    expect(describeScreen(mutation.succeeded)).not.toBe("nothing"),
  );

  return `${describeScreen(mutation.succeeded)} (${describeRequests(mutation)})`;
}

function expectedOutcome(mutation: Mutation, status: number): string {
  if (status === SUCCESS_STATUS[mutation.method])
    return "toast + refresh (1 request)";
  if (status === 401) return "go /sign-in (1 request)";
  return `alert: ${mutation.explanations[status]} (1 request)`;
}

const ROWS = MUTATIONS.flatMap((mutation) =>
  [
    SUCCESS_STATUS[mutation.method],
    401,
    ...Object.keys(mutation.explanations).map(Number),
  ].map((status) => ({
    mutation,
    status,
    label: `${mutation.name} ${status === 0 ? "network failure" : status}`,
  })),
);

afterEach(() => {
  cleanup();
  toast.close();
  mockApi.reset();
  sideEffects.length = 0;
});

afterAll(() => mockApi.close());

describe("Admin mutations eval (threshold: 0 mismatched outcomes; exactly 1 browser request per double submit; 0 retries, cascades, or extra calls)", () => {
  it.each(ROWS)("$label", async ({ mutation, status }) => {
    await expect(observe(mutation, status)).resolves.toBe(
      expectedOutcome(mutation, status),
    );
  });
});
