import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { http } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { toast, Toaster } from "@/shared/ui/toast";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import { TrackAdministrationCard } from "./track-administration-card";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const sideEffects = vi.hoisted(() => [] as string[]);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => sideEffects.push("refresh") }),
}));
const trackUrl = `${TEST_ORIGIN}/api/v1/tracks/track-1`;
const track = {
  id: "track-1",
  name: "Computer Science",
  code: "CSC",
  description: "Details",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderCard() {
  render(
    <>
      {withQueryClient(<TrackAdministrationCard track={track} />)}
      <Toaster />
    </>,
  );
}
async function openAction(action: "Edit" | "Delete") {
  fireEvent.click(
    screen.getByRole("button", { name: "Manage Computer Science" }),
  );
  const menu = await screen.findByRole("menu");
  fireEvent.click(within(menu).getByRole("menuitem", { name: action }));
}
afterEach(() => {
  mockApi.reset();
  sideEffects.length = 0;
  toast.close();
});
afterAll(() => mockApi.close());

describe("TrackAdministrationCard", () => {
  it("edits once, confirms, and refreshes", async () => {
    mockApi.server.use(
      http.patch(trackUrl, async ({ request }) => {
        expect(await request.json()).toEqual({ name: "Data Science" });
        return Response.json({ ...track, name: "Data Science" });
      }),
    );
    renderCard();
    await openAction("Edit");
    const dialog = await screen.findByRole("dialog", {
      name: "Edit Computer Science",
    });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Data Science" },
    });
    act(() => {
      within(dialog).getByRole("button", { name: "Save changes" }).click();
    });
    expect(
      await screen.findByText("Programme Track updated"),
    ).toBeInTheDocument();
    expect(sideEffects).toEqual(["refresh"]);
  });

  it("does not cascade when deletion is blocked by an attachment", async () => {
    let calls = 0;
    mockApi.server.use(
      http.delete(trackUrl, () => {
        calls += 1;
        return new Response(null, { status: 409 });
      }),
    );
    renderCard();
    await openAction("Delete");
    fireEvent.click(
      screen.getByRole("button", { name: "Delete programme track" }),
    );
    expect(await screen.findByText(/still attached/i)).toBeInTheDocument();
    expect(calls).toBe(1);
  });
});
