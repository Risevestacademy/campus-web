import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/shared/theme";

import { ThemeToggle } from "./theme-toggle";

beforeEach(() => {
  document.documentElement.dataset.theme = "light";
  window.localStorage.clear();
});

describe("ThemeToggle", () => {
  it("switches the active theme and persists the preference", () => {
    render(<ThemeToggle />);

    const toggle = screen.getByRole("button", {
      name: "Switch to dark mode",
    });

    fireEvent.click(toggle);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
