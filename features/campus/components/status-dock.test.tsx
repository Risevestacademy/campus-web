import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { socialFor } from "@/core/realtime";
import {
  ADA,
  applyFrame,
  clearPresence,
  seedPresence,
} from "@/tests/fixtures/nearby-presence";
import { serverFrames } from "@/tests/fixtures/world-frames";

import { StatusDock } from "./status-dock";

const COHORT = "status-cohort";
const VIEWER = { id: ADA.userId, displayName: "Ada Lovelace" };

let unbind = () => {};

function connectSocial() {
  const send = vi.fn(() => true);
  const social = socialFor(COHORT);
  unbind = social.bind(send);
  social.apply(serverFrames.welcome);
  social.apply(serverFrames.snapshot);
  return send;
}

function renderDock() {
  render(
    <StatusDock cohortId={COHORT} viewer={VIEWER}>
      <button type="button">Turn on microphone</button>
    </StatusDock>,
  );
}

function trigger() {
  return screen.getByRole("button", { name: /^Your status/ });
}

function openTray() {
  fireEvent.click(trigger());
  return screen.getByRole("region", { name: "Your status" });
}

beforeEach(() => seedPresence(COHORT));

afterEach(() => {
  unbind();
  clearPresence(COHORT);
  vi.useRealTimers();
});

describe("StatusDock", () => {
  it("shows the member's initials and status on the trigger, tray closed", () => {
    renderDock();

    expect(trigger()).toHaveAccessibleName("Your status: Available");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(within(trigger()).getByText("AL")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Your status" }),
    ).not.toBeInTheDocument();
  });

  it("offers the three statuses, no time while available", () => {
    connectSocial();
    renderDock();

    const tray = openTray();

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(
      within(tray)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Available", "Busy", "Away"]);
    expect(
      within(tray).getByRole("button", { name: "Available" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("sends a chosen status and draws it before world answers", () => {
    const send = connectSocial();
    renderDock();
    const tray = openTray();

    fireEvent.click(within(tray).getByRole("button", { name: "Busy" }));

    expect(send).toHaveBeenCalledWith({ type: "setStatus", status: "busy" });
    expect(trigger()).toHaveAccessibleName("Your status: Busy");
    expect(
      within(tray).getByRole("button", { name: "Until I change it" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("times a status and counts down what is left", () => {
    const send = connectSocial();
    renderDock();
    const tray = openTray();
    fireEvent.click(within(tray).getByRole("button", { name: "Away" }));

    fireEvent.click(within(tray).getByRole("button", { name: "1 h" }));

    expect(send).toHaveBeenLastCalledWith({
      type: "setStatus",
      status: "away",
      forSeconds: 3_600,
    });
    expect(trigger()).toHaveAccessibleName("Your status: Away, 1 h left");
    expect(within(tray).getByText("Away · 1 h left")).toBeInTheDocument();
    expect(within(tray).getByRole("button", { name: "1 h" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("replaces a timed status with one that lasts", () => {
    const send = connectSocial();
    renderDock();
    const tray = openTray();
    fireEvent.click(within(tray).getByRole("button", { name: "Busy" }));
    fireEvent.click(within(tray).getByRole("button", { name: "30 min" }));

    fireEvent.click(
      within(tray).getByRole("button", { name: "Until I change it" }),
    );

    expect(send).toHaveBeenLastCalledWith({
      type: "setStatus",
      status: "busy",
    });
    expect(trigger()).toHaveAccessibleName("Your status: Busy");
  });

  it("shows the status world returns to when a timer ends", () => {
    connectSocial();
    renderDock();
    const tray = openTray();
    fireEvent.click(within(tray).getByRole("button", { name: "Busy" }));
    fireEvent.click(within(tray).getByRole("button", { name: "2 h" }));

    act(() =>
      applyFrame(COHORT, {
        type: "statusChanged",
        userId: ADA.userId,
        status: "available",
        until: null,
      }),
    );

    expect(trigger()).toHaveAccessibleName("Your status: Available");
    expect(
      within(tray).queryByRole("button", { name: "2 h" }),
    ).not.toBeInTheDocument();
  });

  it("says why it cannot change the status before world is back", () => {
    clearPresence(COHORT);
    renderDock();

    const tray = openTray();

    expect(
      within(tray).getByText(/once you're back on the campus/),
    ).toBeInTheDocument();
    expect(within(tray).getByRole("button", { name: "Busy" })).toBeDisabled();
  });

  it("refuses today while more than 12 hours of it are left, and says why", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 30, 8, 0, 0));
    connectSocial();
    renderDock();
    const tray = openTray();

    fireEvent.click(within(tray).getByRole("button", { name: "Busy" }));

    expect(within(tray).getByRole("button", { name: "Today" })).toBeDisabled();
    expect(within(tray).getByText(/12 hours at most/)).toBeInTheDocument();
  });

  it("closes on Escape and hands focus back to the trigger", () => {
    connectSocial();
    renderDock();
    const tray = openTray();

    fireEvent.keyDown(within(tray).getByRole("button", { name: "Busy" }), {
      key: "Escape",
    });

    expect(
      screen.queryByRole("region", { name: "Your status" }),
    ).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });
});
