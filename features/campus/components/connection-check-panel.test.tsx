import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ConnectionCheckSteps } from "../hooks/use-connection-check";
import type { ConnectionCheckResult } from "../services/connection-check/check-connection";
import { ConnectionCheckPanel } from "./connection-check-panel";

const PENDING: ConnectionCheckSteps = {
  network: "pending",
  microphone: "pending",
  camera: "pending",
};

function renderPanel({
  steps = PENDING,
  result,
  isRunning = false,
  onStart = vi.fn(),
}: {
  steps?: ConnectionCheckSteps;
  result?: ConnectionCheckResult;
  isRunning?: boolean;
  onStart?: () => void;
} = {}) {
  render(
    <ConnectionCheckPanel
      isRunning={isRunning}
      onStart={onStart}
      result={result}
      steps={steps}
    />,
  );
  return { onStart };
}

describe("ConnectionCheckPanel", () => {
  it("offers the test and says nothing before it runs", () => {
    const { onStart } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    expect(onStart).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows each step while the test runs", () => {
    renderPanel({
      isRunning: true,
      steps: { network: "passed", microphone: "running", camera: "skipped" },
    });

    expect(screen.getByRole("button", { name: "Testing…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Testing your connection…",
    );
    const steps = within(
      screen.getByRole("list", { name: "Connection test steps" }),
    );
    expect(
      steps.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      "NetworkWorking",
      "MicrophoneChecking…",
      "CameraOff, not tested",
    ]);
  });

  it("keeps focus on the button and ignores presses while the test runs", () => {
    const onStart = vi.fn();
    const { rerender } = render(
      <ConnectionCheckPanel
        isRunning={false}
        onStart={onStart}
        result={undefined}
        steps={PENDING}
      />,
    );
    const button = screen.getByRole("button", { name: "Test connection" });
    button.focus();

    rerender(
      <ConnectionCheckPanel
        isRunning
        onStart={onStart}
        result={undefined}
        steps={PENDING}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Testing…" }));

    expect(screen.getByRole("button", { name: "Testing…" })).toHaveFocus();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("announces a failed step with what the member can do", () => {
    renderPanel({
      result: { kind: "step-failed", step: "network" },
      steps: { network: "failed", microphone: "pending", camera: "pending" },
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Your network is blocking calls.");
    expect(status).toHaveTextContent(
      "Try another network, or ask whoever runs it to allow video calls.",
    );
    expect(screen.getByRole("button", { name: "Test again" })).toBeEnabled();
  });

  it("announces a pass and offers another test", () => {
    renderPanel({
      result: { kind: "passed" },
      steps: { network: "passed", microphone: "passed", camera: "passed" },
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your connection is ready for calls.",
    );
    expect(screen.getByRole("button", { name: "Test again" })).toBeEnabled();
  });

  it("keeps the button after a rate limit, saying how long to wait", () => {
    renderPanel({ result: { kind: "rate-limited", retryAfterSeconds: 30 } });

    expect(screen.getByRole("status")).toHaveTextContent(
      "You've tested a few times. Try again in 30 seconds.",
    );
    expect(screen.getByRole("button", { name: "Test again" })).toBeEnabled();
  });

  it("removes the test where calls are unavailable", () => {
    renderPanel({ result: { kind: "unavailable" } });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Calls aren't available on this campus yet.",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
