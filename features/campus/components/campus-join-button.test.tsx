import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import {
  createMediaSessionStore,
  type MediaSessionState,
} from "../services/media-session/media-session-store";
import { CampusJoinButton } from "./campus-join-button";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

describe("CampusJoinButton", () => {
  beforeEach(() => navigation.push.mockClear());

  it("grants the exact destination before navigating and prevents another activation", () => {
    const store = createMediaSessionStore({ mediaDevices: null });
    const statesAtNavigation: MediaSessionState[] = [];
    navigation.push.mockImplementation(() => {
      statesAtNavigation.push(store.getState());
    });
    render(
      <MediaSessionProvider store={store}>
        <CampusJoinButton destination="/campus/c-1/meeting?tab=people" />
      </MediaSessionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(statesAtNavigation[0]?.pendingActiveCampusDestination).toBe(
      "/campus/c-1/meeting?tab=people",
    );
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(
      "/campus/c-1/meeting?tab=people",
    );
    const pendingButton = screen.getByRole("button", { name: "Joining…" });
    expect(pendingButton).toBeDisabled();

    fireEvent.click(pendingButton);
    expect(navigation.push).toHaveBeenCalledOnce();
  });
});
