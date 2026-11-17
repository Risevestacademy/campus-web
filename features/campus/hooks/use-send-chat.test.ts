import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { socialFor } from "@/core/realtime";
import { serverFrames } from "@/tests/fixtures/world-frames";

import { CHAT_LINE_MAX_LENGTH, useSendChat } from "./use-send-chat";

const COHORT = "send-chat-cohort";

let unbind = () => {};

function connect(accepts = true) {
  const send = vi.fn(() => accepts);
  const social = socialFor(COHORT);
  unbind = social.bind(send);
  social.apply(serverFrames.welcome);
  social.apply(serverFrames.snapshot);
  return send;
}

beforeEach(() => {
  unbind();
});

afterEach(() => {
  unbind();
});

describe("useSendChat", () => {
  it("says a trimmed line and reports it sent", () => {
    const send = connect();
    const { result } = renderHook(() => useSendChat(COHORT));

    expect(result.current.send("  hello there  ")).toBe("sent");

    expect(send).toHaveBeenCalledWith({ type: "say", text: "hello there" });
  });

  it("sends nothing for an empty line", () => {
    const send = connect();
    const { result } = renderHook(() => useSendChat(COHORT));

    expect(result.current.send("   ")).toBe("empty");
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a line over the limit and takes nothing from the budget", () => {
    const send = connect();
    const { result } = renderHook(() => useSendChat(COHORT));

    expect(result.current.send("x".repeat(CHAT_LINE_MAX_LENGTH + 1))).toBe(
      "too-long",
    );
    expect(send).not.toHaveBeenCalled();
    for (let line = 0; line < 5; line += 1) {
      expect(result.current.send("again")).toBe("sent");
    }
  });

  it("holds the sixth line sent at once, and keeps it from the socket", () => {
    const send = connect();
    const { result } = renderHook(() => useSendChat(COHORT));
    for (let line = 0; line < 5; line += 1) result.current.send(`line ${line}`);

    expect(result.current.send("one more")).toBe("too-fast");
    expect(send).toHaveBeenCalledTimes(5);
  });

  it("reports a socket that is not ready, and spends nothing", () => {
    const { result } = renderHook(() => useSendChat(COHORT));

    for (let line = 0; line < 8; line += 1) {
      expect(result.current.send("hello")).toBe("not-ready");
    }

    const send = connect();
    expect(result.current.send("hello")).toBe("sent");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
