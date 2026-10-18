import { describe, expect, it } from "vitest";

import type { RealtimeEvent } from "@/core/realtime";
import { serverFrames } from "@/tests/fixtures/world-frames";

import { type AnalyticsCapture, realtimeAnalytics } from "./realtime-analytics";

describe("realtimeAnalytics", () => {
  it("reports a close whose reason world never sent as unknown", () => {
    expect(
      realtimeAnalytics(
        {
          type: "closed",
          code: 1008,
          reason: "ada@campus.local",
          action: "stop",
        },
        "cohort-1",
      ),
    ).toEqual([
      ["realtime.closed", { code: 1008, reason: "unknown", action: "stop" }],
    ]);
  });

  it.each<[string, RealtimeEvent, AnalyticsCapture[]]>([
    [
      "a first connect",
      { type: "connected", attempt: 0 },
      [["realtime.connected", { cohort_id: "cohort-1", reconnect: false }]],
    ],
    [
      "a connect after a drop",
      { type: "connected", attempt: 3 },
      [
        ["realtime.connected", { cohort_id: "cohort-1", reconnect: true }],
        ["realtime.reconnected", { attempts: 3 }],
      ],
    ],
    [
      "a close world explains",
      {
        type: "closed",
        code: 1001,
        reason: "server shutting down",
        action: "reconnect",
      },
      [
        [
          "realtime.closed",
          { code: 1001, reason: "server shutting down", action: "reconnect" },
        ],
      ],
    ],
    [
      "the cap",
      { type: "stopped", outcome: "gave-up", attempts: 10 },
      [["realtime.gave_up", { attempts: 10 }]],
    ],
    [
      "any other stop",
      { type: "stopped", outcome: "entered-elsewhere", attempts: 0 },
      [],
    ],
    ["a message", { type: "message", message: serverFrames.joined }, []],
  ])("reports %s", (_, event, captures) => {
    expect(realtimeAnalytics(event, "cohort-1")).toEqual(captures);
  });
});
