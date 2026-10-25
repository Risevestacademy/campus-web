import { describe, expect, it } from "vitest";

import { ANALYTICS_EVENTS, analyticsEventSchemas } from "./events";

describe("analytics contract evaluation", () => {
  it("passes when every event is a unique canonical object.action name", () => {
    const eventNames = Object.values(ANALYTICS_EVENTS);

    expect(new Set(eventNames).size).toBe(eventNames.length);

    for (const eventName of eventNames) {
      expect(eventName).toMatch(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/);
    }
  });

  it("sends exactly the move corrections someone chose, never a move that landed", () => {
    const { outcome } =
      analyticsEventSchemas[ANALYTICS_EVENTS.CAMPUS_WORLD_MOVE_CORRECTED].shape;

    expect(outcome.options).toEqual([
      "blocked",
      "refused",
      "too_fast",
      "unknown",
    ]);
  });
});
