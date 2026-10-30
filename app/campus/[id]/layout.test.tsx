import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { withQueryClient } from "@/tests/fixtures/query-client";

import JoinPage from "./join/page";
import CohortLayout from "./layout";

vi.mock("@/features/auth", () => import("@/tests/fixtures/route-access-stub"));
vi.mock("@/features/campus-world", () => ({
  CampusMapPreparationGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("404");
  },
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("server-only", () => ({}));

const params = Promise.resolve({ id: "c-1" });

describe("CohortLayout", () => {
  it("renders the Join Gate inside the cohort's Presence Session", async () => {
    render(
      withQueryClient(
        await CohortLayout({
          params,
          children: await JoinPage({
            params,
            searchParams: Promise.resolve({}),
          }),
        }),
      ),
    );

    expect(
      screen.getByRole("button", { name: "Turn on camera" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join" })).toBeEnabled();
  });

  it.each(["", "sub/c-1", "a b"])(
    "responds not-found to cohort id %s",
    async (id) => {
      await expect(
        CohortLayout({
          params: Promise.resolve({ id }),
          children: null,
        }),
      ).rejects.toThrow("404");
    },
  );
});
