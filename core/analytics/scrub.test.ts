import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";

import { scrubAnalyticsEvent, stripUrlQuery } from "./scrub";

const ORIGIN = "https://campus.example";

describe("stripUrlQuery", () => {
  it.each([
    [
      "an invite token",
      `${ORIGIN}/invitation?token=secret`,
      `${ORIGIN}/invitation`,
    ],
    [
      "a returnTo carrying a token",
      `${ORIGIN}/sign-in?returnTo=%2Finvitation%3Ftoken%3Dsecret`,
      `${ORIGIN}/sign-in`,
    ],
    [
      "an OAuth code",
      `${ORIGIN}/callback?code=abc&state=xyz`,
      `${ORIGIN}/callback`,
    ],
    ["a hash", `${ORIGIN}/campus#token=secret`, `${ORIGIN}/campus`],
    [
      "allow-listed view parameters",
      `${ORIGIN}/campus?view=tracks&page=2&email=ada%40campus.local`,
      `${ORIGIN}/campus?view=tracks&page=2`,
    ],
    ["a plain path", `${ORIGIN}/campus/c-1`, `${ORIGIN}/campus/c-1`],
  ])("removes %s", (_, url, expected) => {
    expect(stripUrlQuery(url)).toBe(expected);
  });

  it.each(["$direct", "campus.example", "Cohort 3", "mailto:ada@campus.local"])(
    "leaves the non-web-URL value %j alone",
    (value) => {
      expect(stripUrlQuery(value)).toBe(value);
    },
  );
});

describe("scrubAnalyticsEvent", () => {
  const event = (overrides: Partial<CaptureResult>): CaptureResult => ({
    uuid: "event-1",
    event: "$pageview",
    properties: {},
    ...overrides,
  });

  it("cleans every URL property, whatever PostHog named it", () => {
    const scrubbed = scrubAnalyticsEvent(
      event({
        properties: {
          $current_url: `${ORIGIN}/invitation?token=secret`,
          $referrer: `${ORIGIN}/sign-in?returnTo=%2Finvitation`,
          $session_entry_url: `${ORIGIN}/invitation?token=secret`,
          $pathname: "/invitation",
          $screen_width: 1440,
        },
        $set_once: {
          $initial_current_url: `${ORIGIN}/invitation?token=secret`,
        },
        $set: { $current_url: `${ORIGIN}/invitation?token=secret` },
      }),
    );

    expect(scrubbed).toEqual(
      event({
        properties: {
          $current_url: `${ORIGIN}/invitation`,
          $referrer: `${ORIGIN}/sign-in`,
          $session_entry_url: `${ORIGIN}/invitation`,
          $pathname: "/invitation",
          $screen_width: 1440,
        },
        $set_once: { $initial_current_url: `${ORIGIN}/invitation` },
        $set: { $current_url: `${ORIGIN}/invitation` },
      }),
    );
    expect(JSON.stringify(scrubbed)).not.toContain("secret");
  });

  it("passes a dropped event through as dropped", () => {
    expect(scrubAnalyticsEvent(null)).toBeNull();
  });
});
