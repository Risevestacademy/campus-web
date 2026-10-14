import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useMediaSession } from "../services/media-session/media-session-provider";
import { useAdmission } from "../services/presence-session/presence-session-provider";
import { PresenceSession } from "./presence-session";

function SessionProbe() {
  const pendingDestination = useAdmission((state) => state.pendingDestination);
  const grantEntry = useAdmission((state) => state.grantEntry);
  const cameraStatus = useMediaSession((state) => state.camera.status);

  return (
    <>
      <button onClick={() => grantEntry("/campus/c-1")} type="button">
        Grant entry
      </button>
      <output aria-label="Pending entry">{pendingDestination ?? "none"}</output>
      <output aria-label="Camera">{cameraStatus}</output>
    </>
  );
}

describe("PresenceSession", () => {
  it("provides admission and media to every cohort page", () => {
    render(
      <PresenceSession>
        <SessionProbe />
      </PresenceSession>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Grant entry" }));

    expect(screen.getByLabelText("Pending entry")).toHaveTextContent(
      "/campus/c-1",
    );
    expect(screen.getByLabelText("Camera")).toHaveTextContent("disabled");
  });

  it("starts a fresh session for another cohort", () => {
    const { rerender } = render(
      <PresenceSession key="c-1">
        <SessionProbe />
      </PresenceSession>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Grant entry" }));

    rerender(
      <PresenceSession key="c-2">
        <SessionProbe />
      </PresenceSession>,
    );

    expect(screen.getByLabelText("Pending entry")).toHaveTextContent("none");
  });

  it("forgets admission when the session remounts, as on reload", () => {
    const firstMount = render(
      <PresenceSession>
        <SessionProbe />
      </PresenceSession>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Grant entry" }));
    firstMount.unmount();

    render(
      <PresenceSession>
        <SessionProbe />
      </PresenceSession>,
    );

    expect(screen.getByLabelText("Pending entry")).toHaveTextContent("none");
  });
});
