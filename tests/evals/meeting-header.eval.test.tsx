import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { activeCampusLayout } from "@/tests/fixtures/active-campus-layout";

vi.mock("@/features/auth", () => import("@/tests/fixtures/route-access-stub"));
vi.mock("server-only", () => ({}));

async function renderActiveCampusLayout() {
  return render(await activeCampusLayout());
}

afterEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(document.documentElement.dataset, "sidebarOpen");
});

describe("meeting header UI (required threshold: 2/2)", () => {
  it("renders meeting information without an unavailable lock control", async () => {
    await renderActiveCampusLayout();

    expect(
      screen.getByRole("heading", { name: "Title for meeting" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Participant A" }),
    ).toHaveTextContent("A");
    expect(
      screen.getByRole("img", { name: "2 more participants" }),
    ).toHaveTextContent("+2");

    expect(
      screen.queryByRole("button", { name: "Meeting lock" }),
    ).not.toBeInTheDocument();
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
