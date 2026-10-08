import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

import { toast, Toaster } from "@/shared/ui/toast";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import { CohortTrackAdministration } from "./cohort-track-administration";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const sideEffects = vi.hoisted(() => [] as string[]);

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => sideEffects.push("refresh") }),
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => sideEffects.push(`replace ${href}`),
}));
vi.mock("server-only", () => ({}));

const API_ORIGIN = "https://api.example.test";
const COHORT_ID = "11111111-1111-4111-8111-111111111111";
const ATTACHED_TRACK_ID = "33333333-3333-4333-8333-333333333333";
const AVAILABLE_TRACK_ID = "44444444-4444-4444-8444-444444444444";
const SERVER_COHORT_URL = `${API_ORIGIN}/v1/cohorts/${COHORT_ID}`;
const SERVER_TRACKS_URL = `${API_ORIGIN}/v1/tracks`;
const BROWSER_ATTACHMENTS_URL = `${TEST_ORIGIN}/api/v1/cohorts/${COHORT_ID}/tracks`;
const BROWSER_ASSOCIATION_URL = `${BROWSER_ATTACHMENTS_URL}/${ATTACHED_TRACK_ID}`;

const attachedTrack = {
  id: ATTACHED_TRACK_ID,
  name: "Software Engineering",
  code: "SE",
  description: "Backend and infrastructure",
  createdAt: "2026-09-22T12:00:00.000Z",
  updatedAt: "2026-09-22T12:00:00.000Z",
};
const availableTrack = {
  id: AVAILABLE_TRACK_ID,
  name: "Product Design",
  code: "PD",
  description: null,
  createdAt: "2026-09-22T12:00:00.000Z",
  updatedAt: "2026-09-22T12:00:00.000Z",
};
const attachedAssociation = {
  id: "22222222-2222-4222-8222-222222222222",
  cohortId: COHORT_ID,
  track: attachedTrack,
  createdAt: "2026-09-22T12:00:00.000Z",
};
const cohortDetail = {
  id: COHORT_ID,
  name: "Cohort 1",
  code: "C1",
  startDate: "2026-09-01",
  endDate: null,
  status: "active",
  createdAt: "2026-09-22T12:00:00.000Z",
  updatedAt: "2026-09-22T12:00:00.000Z",
  tracks: [attachedAssociation],
};

function serveReads() {
  mockApi.server.use(
    http.get(SERVER_COHORT_URL, () => Response.json(cohortDetail)),
    http.get(SERVER_TRACKS_URL, ({ request }) => {
      expect(new URL(request.url).searchParams.get("page")).toBe("1");
      return Response.json({
        items: [attachedTrack, availableTrack],
        meta: { page: 1, perPage: 12, total: 2, totalPages: 1 },
      });
    }),
  );
}

async function renderAdministration() {
  render(
    <>
      {withQueryClient(
        await CohortTrackAdministration({ cohortId: COHORT_ID, page: "1" }),
      )}
      <Toaster />
    </>,
  );
}

function mutationRequests(method: "POST" | "DELETE") {
  return mockApi.requests.filter((request) => request.method === method);
}

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", API_ORIGIN);
  serveReads();
});

afterEach(() => {
  cleanup();
  toast.close();
  mockApi.reset();
  sideEffects.length = 0;
  vi.unstubAllEnvs();
});

afterAll(() => mockApi.close());

describe("CohortTrackAdministration", () => {
  it("renders server-read associations and excludes them from attach choices", async () => {
    await renderAdministration();

    expect(
      screen.getByRole("heading", { name: "Cohort 1 Programme Tracks" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Software Engineering")).toBeInTheDocument();

    const choices = screen.getByLabelText("Programme Track");
    expect(
      within(choices).queryByRole("option", { name: /Software Engineering/ }),
    ).not.toBeInTheDocument();
    expect(
      within(choices).getByRole("option", { name: /Product Design/ }),
    ).toBeInTheDocument();
  });

  it("attaches the selected catalogue Track once and refreshes", async () => {
    const bodies: unknown[] = [];
    mockApi.server.use(
      http.post(BROWSER_ATTACHMENTS_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(
          {
            ...attachedAssociation,
            id: "association-2",
            track: availableTrack,
          },
          { status: 201 },
        );
      }),
    );
    await renderAdministration();

    fireEvent.change(screen.getByLabelText("Programme Track"), {
      target: { value: AVAILABLE_TRACK_ID },
    });
    const attach = screen.getByRole("button", { name: "Attach track" });
    act(() => {
      attach.click();
      attach.click();
    });

    expect(
      await screen.findByText("Programme Track attached"),
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ trackId: AVAILABLE_TRACK_ID }]);
    expect(mutationRequests("POST")).toHaveLength(1);
    expect(sideEffects).toEqual(["refresh"]);
  });

  it("detaches the association once and never deletes the Programme Track", async () => {
    mockApi.server.use(
      http.delete(
        BROWSER_ASSOCIATION_URL,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    await renderAdministration();

    fireEvent.click(
      screen.getByRole("button", { name: "Detach Software Engineering" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Detach Software Engineering?",
    });
    const detach = within(dialog).getByRole("button", { name: "Detach track" });
    act(() => {
      detach.click();
      detach.click();
    });

    expect(
      await screen.findByText("Programme Track detached"),
    ).toBeInTheDocument();
    expect(mutationRequests("DELETE").map(({ url }) => url)).toEqual([
      BROWSER_ASSOCIATION_URL,
    ]);
    expect(sideEffects).toEqual(["refresh"]);
  });

  it("keeps a conflicted detachment open and permits a later retry", async () => {
    let attempts = 0;
    mockApi.server.use(
      http.delete(BROWSER_ASSOCIATION_URL, () => {
        attempts += 1;
        return attempts === 1
          ? new Response(null, { status: 409 })
          : new Response(null, { status: 204 });
      }),
    );
    await renderAdministration();

    fireEvent.click(
      screen.getByRole("button", { name: "Detach Software Engineering" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Detach Software Engineering?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Detach track" }),
    );

    expect(
      await within(dialog).findByText(/students or Invitations/i),
    ).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Detach track" }),
    );

    expect(
      await screen.findByText("Programme Track detached"),
    ).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("keeps a failed attachment selected and permits a later retry", async () => {
    let attempts = 0;
    mockApi.server.use(
      http.post(BROWSER_ATTACHMENTS_URL, () => {
        attempts += 1;
        return attempts === 1
          ? new Response(null, { status: 409 })
          : HttpResponse.json(
              {
                ...attachedAssociation,
                id: "association-2",
                track: availableTrack,
              },
              { status: 201 },
            );
      }),
    );
    await renderAdministration();

    const choices = screen.getByLabelText("Programme Track");
    fireEvent.change(choices, { target: { value: AVAILABLE_TRACK_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Attach track" }));

    expect(await screen.findByText(/already attached/i)).toBeInTheDocument();
    expect(choices).toHaveValue(AVAILABLE_TRACK_ID);

    fireEvent.click(screen.getByRole("button", { name: "Attach track" }));

    expect(
      await screen.findByText("Programme Track attached"),
    ).toBeInTheDocument();
    await waitFor(() => expect(attempts).toBe(2));
  });
});
