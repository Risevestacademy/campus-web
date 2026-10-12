import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useMediaSession } from "@/features/campus";

import JoinPage from "./join/page";
import MediaSessionLayout from "./layout";

vi.mock("@/features/auth", () => import("@/tests/fixtures/route-access-stub"));
vi.mock("@/features/campus-world", () => ({
  CampusMapPreparationGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("server-only", () => ({}));

const params = Promise.resolve({ id: "c-1" });

function PendingEntryProbe({ destination }: { destination: string }) {
  const pendingDestination = useMediaSession(
    (state) => state.pendingActiveCampusDestination,
  );
  const grantActiveCampusEntry = useMediaSession(
    (state) => state.grantActiveCampusEntry,
  );

  return (
    <>
      <button onClick={() => grantActiveCampusEntry(destination)} type="button">
        Grant entry
      </button>
      <output aria-label="Pending entry">{pendingDestination ?? "none"}</output>
    </>
  );
}

describe("MediaSessionLayout", () => {
  it("renders the Join Gate inside the shared media session", async () => {
    render(
      await MediaSessionLayout({
        params,
        children: await JoinPage({ params, searchParams: Promise.resolve({}) }),
      }),
    );

    expect(
      screen.getByRole("button", { name: "Turn on camera" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join" })).toBeEnabled();
  });

  it("starts a fresh route session when the cohort changes", async () => {
    const { rerender } = render(
      await MediaSessionLayout({
        params: Promise.resolve({ id: "c-1" }),
        children: <PendingEntryProbe destination="/campus/c-1" />,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Grant entry" }));
    expect(screen.getByLabelText("Pending entry")).toHaveTextContent(
      "/campus/c-1",
    );

    rerender(
      await MediaSessionLayout({
        params: Promise.resolve({ id: "c-2" }),
        children: <PendingEntryProbe destination="/campus/c-2" />,
      }),
    );

    expect(screen.getByLabelText("Pending entry")).toHaveTextContent("none");
  });
});
