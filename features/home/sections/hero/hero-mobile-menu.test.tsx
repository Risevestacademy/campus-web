import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HeroMobileMenu } from "./hero-mobile-menu";
import { enterCampusHref, navigationLinks } from "./navigation-links";

describe("HeroMobileMenu", () => {
  it("reveals the navigation links when opened", () => {
    render(<HeroMobileMenu />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    for (const { label, href } of navigationLinks) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }

    expect(screen.getByRole("link", { name: "Enter Campus" })).toHaveAttribute(
      "href",
      enterCampusHref,
    );
  });

  it("closes after a link is chosen", () => {
    render(<HeroMobileMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("link", { name: "FAQs" }));

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("closes on Escape and returns focus to the menu button", () => {
    render(<HeroMobileMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.keyDown(screen.getByRole("link", { name: "FAQs" }), {
      key: "Escape",
    });

    const button = screen.getByRole("button", { name: "Open menu" });

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});
