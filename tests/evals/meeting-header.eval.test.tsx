import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { activeCampusLayout } from "@/tests/fixtures/active-campus-layout";
import {
  clearPresence,
  GRACE,
  LIN,
  MAYA,
  seedPresence,
} from "@/tests/fixtures/nearby-presence";

vi.mock("@/features/auth", () => import("@/tests/fixtures/route-access-stub"));
vi.mock("server-only", () => ({}));

async function renderActiveCampusLayout() {
  return render(await activeCampusLayout());
}

beforeEach(() => {
  seedPresence("c-1", GRACE, LIN, MAYA);
});

afterEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(document.documentElement.dataset, "sidebarOpen");
  clearPresence("c-1");
});

describe("meeting header UI (required threshold: 3/3)", () => {
  it("renders meeting information without an unavailable lock control", async () => {
    await renderActiveCampusLayout();

    expect(screen.getByRole("heading", { name: "Nearby" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveTextContent(
      "AL",
    );
    expect(
      screen.getByRole("img", { name: "1 more participant" }),
    ).toHaveTextContent("+1");

    expect(
      screen.queryByRole("button", { name: "Meeting lock" }),
    ).not.toBeInTheDocument();
  });

  it("shows the header settled when the page opens mid-encounter", async () => {
    await renderActiveCampusLayout();

    const nearbyGroup = screen.getByRole("heading", {
      name: "Nearby",
    }).parentElement;

    expect(nearbyGroup).not.toHaveStyle({ opacity: "0" });
  });

  it("opens the campus sidebar from the header", async () => {
    await renderActiveCampusLayout();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(document.documentElement.dataset.sidebarOpen).toBe("false");

    const openSidebar = screen.getByRole("button", { name: "Open sidebar" });

    fireEvent.click(openSidebar);

    expect(document.documentElement.dataset.sidebarOpen).toBe("true");
  });
});
