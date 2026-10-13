import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import JoinPage from "./join/page";
import CohortLayout from "./layout";

vi.mock("@/features/auth", () => import("@/tests/fixtures/route-access-stub"));
vi.mock("@/features/campus-world", () => ({
  CampusMapPreparationGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("server-only", () => ({}));

const params = Promise.resolve({ id: "c-1" });

describe("CohortLayout", () => {
  it("renders the Join Gate inside the cohort's Presence Session", async () => {
    render(
      await CohortLayout({
        params,
        children: await JoinPage({ params, searchParams: Promise.resolve({}) }),
      }),
    );

    expect(
      screen.getByRole("button", { name: "Turn on camera" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join" })).toBeEnabled();
  });
});
