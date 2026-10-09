import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { http } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import { CreateTrackTile } from "./create-track-tile";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const sideEffects = vi.hoisted(() => [] as string[]);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => sideEffects.push("refresh") }),
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => sideEffects.push(`replace ${href}`),
}));

const CREATE_URL = `${TEST_ORIGIN}/api/v1/tracks`;

function renderTile() {
  render(withQueryClient(<CreateTrackTile />));
}

async function openAndFillTrack() {
  fireEvent.click(
    screen.getByRole("button", { name: "Create Programme Track" }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Create a Programme Track",
  });
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: "Computer Science" },
  });
  fireEvent.change(within(dialog).getByLabelText("Code"), {
    target: { value: "duplicate" },
  });
  return dialog;
}

afterEach(() => {
  cleanup();
  mockApi.reset();
  sideEffects.length = 0;
});
afterAll(() => mockApi.close());

describe("CreateTrackTile", () => {
  it.each([
    [
      400,
      "campus-api rejected these details. Review the fields and try again.",
    ],
    [403, "You no longer have permission to create Programme Tracks."],
    [409, "Another Programme Track already uses this code."],
    [
      503,
      "We couldn't create this Programme Track. Check your connection and try again.",
    ],
  ])("retains values and explains HTTP %i", async (status, expectedMessage) => {
    mockApi.server.use(
      http.post(CREATE_URL, () => new Response(null, { status })),
    );
    renderTile();
    const dialog = await openAndFillTrack();
    const submit = within(dialog).getByRole("button", {
      name: "Create programme track",
    });

    act(() => {
      submit.click();
      submit.click();
    });

    expect(await within(dialog).findByText(expectedMessage)).toBeVisible();
    expect(within(dialog).getByLabelText("Code")).toHaveValue("duplicate");
    expect(
      mockApi.requests.filter(({ method }) => method === "POST"),
    ).toHaveLength(1);
  });

  it("cannot close while creation is pending", async () => {
    mockApi.server.use(
      http.post(CREATE_URL, () => new Promise<Response>(() => {})),
    );
    renderTile();
    const dialog = await openAndFillTrack();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Create programme track",
      }),
    );
    expect(
      await within(dialog).findByRole("button", { name: "Creating…" }),
    ).toBeDisabled();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    expect(
      screen.getByRole("dialog", { name: "Create a Programme Track" }),
    ).toBeInTheDocument();
  });

  it("replaces the document after the session expires", async () => {
    mockApi.server.use(
      http.post(CREATE_URL, () => new Response(null, { status: 401 })),
    );
    renderTile();
    const dialog = await openAndFillTrack();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Create programme track",
      }),
    );

    await vi.waitFor(() => expect(sideEffects).toEqual(["replace /sign-in"]));
  });
});
