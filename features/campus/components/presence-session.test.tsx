import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useMediaSession } from "../services/media-session/media-session-provider";
import {
  useAdmission,
  usePresenceTab,
} from "../services/presence-session/presence-session-provider";
import { createFakeLockManager, settle } from "../testing/fake-presence-locks";
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

function PresenceTabProbe() {
  const { claim, status } = usePresenceTab();

  return (
    <>
      <button onClick={() => void claim()} type="button">
        Join
      </button>
      <output aria-label="Presence Tab">{status}</output>
    </>
  );
}

const HOLD_FOREVER = () => new Promise<void>(() => {});

describe("PresenceSession", () => {
  it("provides admission and media to every cohort page", () => {
    render(
      <PresenceSession cohortId="c-1">
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
      <PresenceSession cohortId="c-1" key="c-1">
        <SessionProbe />
      </PresenceSession>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Grant entry" }));

    rerender(
      <PresenceSession cohortId="c-2" key="c-2">
        <SessionProbe />
      </PresenceSession>,
    );

    expect(screen.getByLabelText("Pending entry")).toHaveTextContent("none");
  });

  it("forgets admission when the session remounts, as on reload", () => {
    const firstMount = render(
      <PresenceSession cohortId="c-1">
        <SessionProbe />
      </PresenceSession>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Grant entry" }));
    firstMount.unmount();

    render(
      <PresenceSession cohortId="c-1">
        <SessionProbe />
      </PresenceSession>,
    );

    expect(screen.getByLabelText("Pending entry")).toHaveTextContent("none");
  });

  it("lets every tab join when the browser has no Web Locks", () => {
    render(
      <PresenceSession cohortId="c-1">
        <PresenceTabProbe />
      </PresenceSession>,
    );

    expect(screen.getByLabelText("Presence Tab")).toHaveTextContent("vacant");
  });

  describe("with Web Locks", () => {
    const presenceLock = "campus-presence:c-3";
    let lockManager: ReturnType<typeof createFakeLockManager>;

    beforeEach(() => {
      lockManager = createFakeLockManager();
      Object.defineProperty(navigator, "locks", {
        configurable: true,
        value: lockManager.forClient("this-tab"),
      });
    });

    afterEach(() => {
      Reflect.deleteProperty(navigator, "locks");
    });

    it("shows that another tab holds the cohort", async () => {
      void lockManager
        .forClient("other-tab")
        .request(presenceLock, {}, HOLD_FOREVER);

      render(
        <PresenceSession cohortId="c-3">
          <PresenceTabProbe />
        </PresenceSession>,
      );

      expect(await screen.findByText("elsewhere")).toBeInTheDocument();
    });

    it("ends the session when another tab takes it over", async () => {
      render(
        <PresenceSession cohortId="c-3">
          <SessionProbe />
          <PresenceTabProbe />
        </PresenceSession>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Grant entry" }));
      fireEvent.click(screen.getByRole("button", { name: "Join" }));
      expect(await screen.findByText("held")).toBeInTheDocument();

      void lockManager
        .forClient("other-tab")
        .request(presenceLock, { steal: true }, HOLD_FOREVER);

      expect(await screen.findByText("taken-over")).toBeInTheDocument();
      expect(screen.getByLabelText("Pending entry")).toHaveTextContent("none");
    });

    it("releases the cohort when the session ends", async () => {
      const { unmount } = render(
        <PresenceSession cohortId="c-3">
          <PresenceTabProbe />
        </PresenceSession>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Join" }));
      expect(await screen.findByText("held")).toBeInTheDocument();

      unmount();
      await settle();

      expect(lockManager.holderOf(presenceLock)).toBeUndefined();
    });
  });
});
