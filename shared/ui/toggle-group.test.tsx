import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

describe("ToggleGroup", () => {
  it("renders items owned by a ToggleGroup", () => {
    render(
      <ToggleGroup defaultValue={["all"]}>
        <ToggleGroupItem value="all">All</ToggleGroupItem>
      </ToggleGroup>,
    );

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
  });

  it("reports a ToggleGroupItem without its root", () => {
    expect(() =>
      render(<ToggleGroupItem value="all">All</ToggleGroupItem>),
    ).toThrowError("ToggleGroupItem must be rendered inside ToggleGroup.");
  });
});
