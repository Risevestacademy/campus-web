import { describe, expect, it } from "vitest";

import { pinMediaUrl, readMediaOrigin } from "./media-origin";

const MEDIA_ORIGIN = "wss://media.example.test";

describe("readMediaOrigin", () => {
  it.each([
    ["a public wss origin", "wss://media.example.test", MEDIA_ORIGIN],
    ["a padded origin", " wss://media.example.test ", MEDIA_ORIGIN],
    [
      "loopback ws for the local container",
      "ws://localhost:7880",
      "ws://localhost:7880",
    ],
    ["loopback ws on 127.0.0.1", "ws://127.0.0.1:7880", "ws://127.0.0.1:7880"],
  ])("reads %s", (_, configured, expected) => {
    expect(readMediaOrigin({ NEXT_PUBLIC_MEDIA_URL: configured })).toBe(
      expected,
    );
  });

  it.each([
    ["an unset variable", undefined],
    ["an empty variable", ""],
  ])("reads %s as no media server", (_, configured) => {
    expect(
      readMediaOrigin({ NEXT_PUBLIC_MEDIA_URL: configured }),
    ).toBeUndefined();
  });

  it.each([
    ["plain ws on a public host", "ws://media.example.test"],
    ["https instead of wss", "https://media.example.test"],
    ["a Railway private host", "wss://media.railway.internal"],
    ["a path", "wss://media.example.test/rtc"],
    ["credentials", "wss://user:secret@media.example.test"],
    ["not a URL", "media.example.test"],
  ])("refuses %s", (_, configured) => {
    expect(() =>
      readMediaOrigin({ NEXT_PUBLIC_MEDIA_URL: configured }),
    ).toThrow("NEXT_PUBLIC_MEDIA_URL");
  });
});

describe("pinMediaUrl", () => {
  it.each([
    ["the pinned origin", MEDIA_ORIGIN],
    ["the pinned origin with a trailing slash", `${MEDIA_ORIGIN}/`],
    ["the pinned host in capitals", "wss://MEDIA.example.test"],
  ])("accepts %s", (_, url) => {
    expect(pinMediaUrl(url, MEDIA_ORIGIN)).toBe(MEDIA_ORIGIN);
  });

  it.each([
    ["another host", "wss://evil.example.test"],
    [
      "the pinned host as userinfo",
      "wss://media.example.test@evil.example.test",
    ],
    ["a downgrade to ws", "ws://media.example.test"],
    ["another port", "wss://media.example.test:8443"],
    ["a subdomain of the pinned host", "wss://x.media.example.test"],
    ["a path", `${MEDIA_ORIGIN}/rtc`],
    ["not a URL", "media.example.test"],
  ])("refuses %s", (_, url) => {
    expect(pinMediaUrl(url, MEDIA_ORIGIN)).toBeUndefined();
  });
});
