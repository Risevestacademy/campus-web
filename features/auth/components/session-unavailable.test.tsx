import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SessionUnavailable } from "./session-unavailable";

describe("SessionUnavailable", () => {
  it("tells the visitor their session could not be checked", () => {
    render(<SessionUnavailable retryHref="/campus/42?tab=people" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't check your session",
    );
  });

  it("retries the same destination with a full page request", () => {
    render(<SessionUnavailable retryHref="/campus/42?tab=people" />);

    const retry = screen.getByRole("link", { name: "Try again" });
    expect(retry).toHaveAttribute("href", "/campus/42?tab=people");
  });
});
