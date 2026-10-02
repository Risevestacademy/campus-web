import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Forbidden from "./forbidden";

describe("Forbidden", () => {
  it("tells the visitor they cannot open the page", () => {
    render(<Forbidden />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "You don't have access to this page",
      }),
    ).toBeInTheDocument();
  });

  it("offers a way back to the Campus index", () => {
    render(<Forbidden />);

    expect(
      screen.getByRole("link", { name: "Back to Campus" }),
    ).toHaveAttribute("href", "/campus");
  });
});
