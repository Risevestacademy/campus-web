import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import { PresenceDock } from "./presence-dock";

function renderDock(userName: string | null = "Ada Lovelace") {
  render(
    <MediaSessionProvider
      store={createMediaSessionStore({ mediaDevices: null })}
    >
      <PresenceDock cohortId="c-1" userName={userName} />
    </MediaSessionProvider>,
  );

  return screen.getByRole("complementary", { name: "Presence dock" });
}

describe("PresenceDock", () => {
  it("keeps the member's media controls and a way back to the map", () => {
    const dock = renderDock();

    expect(
      within(dock).getByRole("button", { name: "Turn on camera" }),
    ).toBeInTheDocument();
    expect(
      within(dock).getByRole("button", { name: "Turn on microphone" }),
    ).toBeInTheDocument();
    expect(
      within(dock).getByRole("link", { name: "Campus map" }),
    ).toHaveAttribute("href", "/campus/c-1");
  });

  it("leaves the cohort through the campus chooser", () => {
    const dock = renderDock();

    expect(
      within(dock).getByRole("link", { name: "Back to campuses" }),
    ).toHaveAttribute("href", "/campus");
  });

  it("shows the member's initials on the presence avatar", () => {
    const dock = renderDock("ada  lovelace byron");

    expect(within(dock).getByText("AL")).toBeInTheDocument();
  });

  it("shows a neutral avatar when the member has no display name", () => {
    const dock = renderDock(null);

    expect(within(dock).getByText("?")).toBeInTheDocument();
  });

  it("offers no placeholder actions without behaviour", () => {
    const dock = renderDock();

    expect(
      within(dock).queryByRole("group", { name: "Campus actions" }),
    ).not.toBeInTheDocument();
    expect(
      within(dock).queryByRole("group", { name: "Zoom controls" }),
    ).not.toBeInTheDocument();
  });
});
