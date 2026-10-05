import { describe, expect, it } from "vitest";

import { ANALYTICS_EVENTS } from "./events";

describe("analytics contract evaluation", () => {
  it("passes when every event is a unique canonical object.action name", () => {
    const eventNames = Object.values(ANALYTICS_EVENTS);

    expect(new Set(eventNames).size).toBe(eventNames.length);

    for (const eventName of eventNames) {
      expect(eventName).toMatch(/^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/);
    }
  });
});
