import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RealtimeStatus } from "@/core/realtime";

import { WorldSessionProvider } from "../services/world-session/world-session-provider";
import { createTestWorldSession } from "../testing/world-session-test-utils";
import { WorldConnectionStatus } from "./world-connection-status";

function renderStatus(status: RealtimeStatus) {
  const world = createTestWorldSession(status);
  render(
    <WorldSessionProvider world={world}>
      <WorldConnectionStatus />
    </WorldSessionProvider>,
  );
  return world;
}

describe("WorldConnectionStatus", () => {
  it.each<[string, RealtimeStatus]>([
    ["connected", { phase: "connected" }],
    ["a first connect", { phase: "connecting", attempt: 0 }],
    ["the first retry", { phase: "reconnecting", attempt: 1 }],
    ["the first retry's socket", { phase: "connecting", attempt: 1 }],
    [
      "opened somewhere else",
      { phase: "closed", outcome: "entered-elsewhere" },
    ],
  ])("says nothing while %s", (_, status) => {
    renderStatus(status);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it.each<[string, RealtimeStatus]>([
    ["waiting for", { phase: "reconnecting", attempt: 2 }],
    ["opening the socket of", { phase: "connecting", attempt: 2 }],
  ])("says it is reconnecting while %s a later retry", (_, status) => {
    renderStatus(status);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Reconnecting to campus…",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each(["gave-up", "stop"] as const)(
    "offers Reconnect once world is given up on (%s)",
    (outcome) => {
      const world = renderStatus({ phase: "closed", outcome });

      expect(screen.getByRole("status")).toHaveTextContent(
        "You're offline in the campus",
      );
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
      });

      expect(world.reconnects()).toBe(1);
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    },
  );
});
