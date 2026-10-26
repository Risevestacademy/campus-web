import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import { ConnectionCheck } from "./connection-check";

const browserCheck = vi.hoisted(() => ({
  checkBrowserConnection: vi.fn(),
  isConnectionCheckConfigured: vi.fn(() => true),
}));

vi.mock(
  "../services/connection-check/browser-connection-check",
  () => browserCheck,
);

function renderConnectionCheck() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MediaSessionProvider
        store={createMediaSessionStore({ mediaDevices: null })}
      >
        <ConnectionCheck />
      </MediaSessionProvider>
    </QueryClientProvider>,
  );
}

describe("ConnectionCheck", () => {
  it("is absent from a build that names no media server", () => {
    browserCheck.isConnectionCheckConfigured.mockReturnValueOnce(false);

    renderConnectionCheck();

    expect(
      screen.queryByRole("region", { name: "Connection test" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("runs the check on a press and announces the result", async () => {
    browserCheck.checkBrowserConnection.mockImplementationOnce(
      async (_readTrack, { onStep }) => {
        onStep("network", "failed");
        return { kind: "step-failed", step: "network" };
      },
    );
    renderConnectionCheck();
    expect(
      screen.getByRole("region", { name: "Connection test" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    expect(
      await screen.findByText("Your network is blocking calls."),
    ).toBeInTheDocument();
    expect(browserCheck.checkBrowserConnection).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
