import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MeetingHeader } from "@/features/campus";

const participants = [
  { id: "ada", initials: "AD", name: "Ada" },
  { id: "jo", initials: "JO", name: "Jo" },
] as const;

describe("meeting header UI (required threshold: 3/3)", () => {
  it("renders supplied meeting information and accessible controls", () => {
    render(
      <MeetingHeader
        title="Design sync"
        participants={participants}
        remainingParticipantCount={2}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Design sync" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ada" })).toHaveTextContent("AD");
    expect(
      screen.getByRole("img", { name: "2 more participants" }),
    ).toHaveTextContent("+2");
    expect(
      screen.getByRole("button", { name: "Open sidebar" }),
    ).toBeInTheDocument();

    const lockToggle = screen.getByRole("button", { name: "Meeting lock" });

    expect(lockToggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(lockToggle);

    expect(lockToggle).toHaveAttribute("aria-pressed", "true");
  });
});
