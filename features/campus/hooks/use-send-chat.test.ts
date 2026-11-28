import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { socialFor } from "@/core/realtime";
import { clearPresence, seedPresence } from "@/tests/fixtures/nearby-presence";
import { serverFrames } from "@/tests/fixtures/world-frames";

import { resetSendBudgets } from "../services/chat/send-budget";
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
  seedPresence(COHORT);
  resetSendBudgets();
});

afterEach(() => {
  unbind();
  clearPresence(COHORT);
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

  it("keeps the budget when the composer leaves the screen and comes back", () => {
    const send = connect();
    const first = renderHook(() => useSendChat(COHORT));
    for (let line = 0; line < 5; line += 1) {
      first.result.current.send(`line ${line}`);
    }
    first.unmount();

    const { result } = renderHook(() => useSendChat(COHORT));

    expect(result.current.send("one more")).toBe("too-fast");
    expect(send).toHaveBeenCalledTimes(5);
  });

  it("sends a file with no line, and with one", () => {
    const send = connect();
    const { result } = renderHook(() => useSendChat(COHORT));
    const attachment = {
      mediaId: "m-1",
      fileName: "plan.pdf",
      contentType: "application/pdf",
      sizeBytes: 12,
    };

    expect(result.current.send("", attachment)).toBe("sent");
    expect(result.current.send("  Here it is ", attachment)).toBe("sent");

    expect(send).toHaveBeenNthCalledWith(1, {
      type: "say",
      text: "",
      attachment,
    });
    expect(send).toHaveBeenNthCalledWith(2, {
      type: "say",
      text: "Here it is",
      attachment,
    });
  });

  it("reports whether a line could go out before anything is done for it", () => {
    connect();
    const { result } = renderHook(() => useSendChat(COHORT));
    expect(result.current.readiness()).toBe("ready");

    for (let line = 0; line < 5; line += 1) result.current.send("hello");

    expect(result.current.readiness()).toBe("too-fast");
  });

  it("is not ready while the socket is down", () => {
    clearPresence(COHORT);
    const { result } = renderHook(() => useSendChat(COHORT));

    expect(result.current.readiness()).toBe("not-ready");
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
