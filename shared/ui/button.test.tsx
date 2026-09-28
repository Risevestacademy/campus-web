import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("gives popup triggers reduced-motion-safe press feedback", () => {
    render(<Button aria-haspopup="menu">Open settings</Button>);

    const trigger = screen.getByRole("button", { name: "Open settings" });

    expect(trigger).toHaveClass("active:translate-y-px");
    expect(trigger).toHaveClass("active:aria-[haspopup]:scale-[0.97]");
    expect(trigger).toHaveClass("motion-reduce:active:translate-y-0");
    expect(trigger).toHaveClass(
      "motion-reduce:active:aria-[haspopup]:scale-100",
    );
  });
});
