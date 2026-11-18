import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CampusError from "./error";

describe("CampusError", () => {
  it("retries the failed section when asked", () => {
    const retry = vi.fn();
    render(<CampusError error={new Error("boom")} unstable_retry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it("offers the error reference and a way back to the campus index", () => {
    const error = Object.assign(new Error("boom"), { digest: "1234567890" });
    render(<CampusError error={error} unstable_retry={vi.fn()} />);

    expect(screen.getByText("Reference: 1234567890")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to campuses" }),
    ).toHaveAttribute("href", "/campus");
  });
});
