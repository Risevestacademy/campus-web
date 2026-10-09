import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import JoinPage from "./join/page";
import MediaSessionLayout from "./layout";

vi.mock("@/features/auth", () => import("@/tests/fixtures/route-access-stub"));
vi.mock("server-only", () => ({}));

const params = Promise.resolve({ id: "c-1" });

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
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute(
      "href",
      "/campus/c-1",
    );
  });
});
