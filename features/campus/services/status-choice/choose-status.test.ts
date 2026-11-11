// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { chooseStatus } from "./choose-status";

const NOW = Date.parse("2026-10-30T09:00:00.000Z");

function ports(sent: boolean) {
  return {
    social: { sendSetStatus: vi.fn(() => sent) },
    drawOwnStatus: vi.fn(),
    now: () => NOW,
  };
}

describe("chooseStatus", () => {
  it("sends a status that lasts and draws it at once", () => {
    const choice = ports(true);

    expect(chooseStatus(choice, "busy")).toBe(true);

    expect(choice.social.sendSetStatus).toHaveBeenCalledWith("busy", undefined);
    expect(choice.drawOwnStatus).toHaveBeenCalledWith("busy", null);
  });

  it("draws a timed status ending when world will end it", () => {
    const choice = ports(true);

    chooseStatus(choice, "away", 1_800);

    expect(choice.social.sendSetStatus).toHaveBeenCalledWith("away", 1_800);
    expect(choice.drawOwnStatus).toHaveBeenCalledWith(
      "away",
      "2026-10-30T09:30:00.000Z",
    );
  });

  it("draws nothing when the frame cannot be sent", () => {
    const choice = ports(false);

    expect(chooseStatus(choice, "busy", 3_600)).toBe(false);

    expect(choice.drawOwnStatus).not.toHaveBeenCalled();
  });
});
