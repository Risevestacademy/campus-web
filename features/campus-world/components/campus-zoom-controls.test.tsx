import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeCampusRuntime } from "../testing/fake-campus-runtime";
import { CampusZoomControls } from "./campus-zoom-controls";

function renderControls() {
  const runtime = fakeCampusRuntime();
  render(<CampusZoomControls dependencies={{ runtime }} />);
  return runtime;
}

describe("CampusZoomControls", () => {
  it("stacks the zoom buttons vertically", () => {
    renderControls();

    expect(
      screen.getByRole("group", { name: "Zoom controls" }),
    ).toHaveAttribute("data-orientation", "vertical");
  });

  it.each([
    ["Zoom in", 1],
    ["Zoom out", -1],
  ])("asks the campus camera to step when %s is pressed", (name, step) => {
    const runtime = renderControls();

    fireEvent.click(screen.getByRole("button", { name }));

    expect(runtime.zoom).toHaveBeenCalledExactlyOnceWith(step);
  });

  it.each(["Zoom in", "Zoom out"])(
    "leaves focus on the map when %s is pressed",
    (name) => {
      renderControls();

      const focusMoves = fireEvent.mouseDown(
        screen.getByRole("button", { name }),
      );

      expect(focusMoves).toBe(false);
    },
  );
});
