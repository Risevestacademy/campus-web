import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminSidebar } from "./admin-sidebar";

const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

function currentLinks() {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);
}

function renderSidebar() {
  render(<AdminSidebar cohortId="c-1" collapseButton={null} />);
}

beforeEach(() => {
  pathname.current = "/";
});

describe("AdminSidebar", () => {
  it.each([
    ["/campus/c-1/overview", "Overview"],
    ["/campus/c-1/people", "People"],
    ["/campus/c-1/tracks", "Programme Tracks"],
    ["/campus/c-1/feedback", "Feedback & reports"],
  ])("marks %s as the current page", (path, label) => {
    pathname.current = path;
    renderSidebar();

    expect(currentLinks()).toEqual([label]);
  });

  it("keeps People current on a person's page", () => {
    pathname.current =
      "/campus/c-1/people/3f0c2d1a-6b6e-4c4b-8f55-0c9d1e5a7b21";
    renderSidebar();

    expect(currentLinks()).toEqual(["People"]);
  });

  it("does not mark a section whose name only starts the same", () => {
    pathname.current = "/campus/c-1/people-archive";
    renderSidebar();

    expect(currentLinks()).toEqual([]);
  });

  it("marks nothing on a page outside Administration", () => {
    pathname.current = "/campus/c-1";
    renderSidebar();

    expect(currentLinks()).toEqual([]);
  });
});
