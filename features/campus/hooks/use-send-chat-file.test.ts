import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { presenceFor } from "@/core/presence";
import { socialFor } from "@/core/realtime";
import { uploadMedia, type UploadProblem } from "@/core/uploads";
import {
  applyFrame,
  clearPresence,
  seedPresence,
} from "@/tests/fixtures/nearby-presence";
import { serverFrames } from "@/tests/fixtures/world-frames";

import { attachToCall } from "../services/chat/chat-attachment-api.adapter";
import { resetSendBudgets } from "../services/chat/send-budget";
import {
  MOVED_SPACE_MESSAGE,
  NO_CALL_SPACE_MESSAGE,
  useSendChatFile,
} from "./use-send-chat-file";

const replaceDocument = vi.hoisted(() => vi.fn());

vi.mock("@/core/uploads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/uploads")>()),
  uploadMedia: vi.fn(),
}));
vi.mock("../services/chat/chat-attachment-api.adapter", () => ({
  attachToCall: vi.fn(),
}));
vi.mock("@/shared/lib/document-navigation", () => ({ replaceDocument }));

const COHORT = "send-chat-file-cohort";
const COHORT_ID = "11111111-1111-4111-8111-111111111111";
const SPACE_ID = "7c2f0a64-93d1-4a52-a5d7-0b6c9f4c2e11";
const ATTACHMENT = {
  mediaId: "m-1",
  fileName: "plan.pdf",
  contentType: "application/pdf",
  sizeBytes: 1234,
};

let unbind = () => {};

function connect() {
  const send = vi.fn(() => true);
  const social = socialFor(COHORT);
  unbind = social.bind(send);
  social.apply(serverFrames.welcome);
  social.apply(serverFrames.snapshot);
  return send;
}

function enterRoom() {
  applyFrame(COHORT, {
    type: "call",
    call: {
      url: "wss://media.example.test",
      token: "media-token",
      hearing: "room",
      audibleRadius: 6,
      room: `space:${COHORT_ID}:${SPACE_ID}`,
    },
  });
}

const pdf = () => new File(["x"], "plan.pdf", { type: "application/pdf" });

beforeEach(() => {
  resetSendBudgets();
  seedPresence(COHORT);
  vi.mocked(uploadMedia).mockResolvedValue({
    kind: "uploaded",
    mediaId: "m-1",
  });
  vi.mocked(attachToCall).mockResolvedValue({
    kind: "attached",
    attachment: ATTACHMENT,
  });
});

afterEach(() => {
  unbind();
  clearPresence(COHORT);
  vi.mocked(uploadMedia).mockReset();
  vi.mocked(attachToCall).mockReset();
  replaceDocument.mockReset();
});

describe("useSendChatFile", () => {
  it("uploads the file, ties it to the space's call and says it with the caption", async () => {
    const send = connect();
    enterRoom();
    const { result } = renderHook(() => useSendChatFile(COHORT));
    const file = pdf();

    let sent = false;
    await act(async () => {
      sent = await result.current.sendFile(file, "  Here it is  ");
    });

    expect(sent).toBe(true);
    expect(uploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "call_chat_attachment",
        file,
        fileName: "plan.pdf",
      }),
    );
    expect(attachToCall).toHaveBeenCalledWith(expect.anything(), {
      cohortId: COHORT,
      mediaId: "m-1",
      spaceId: SPACE_ID,
    });
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: "say",
      text: "Here it is",
      attachment: ATTACHMENT,
    });
    expect(result.current.activity).toEqual({ kind: "idle" });
    expect(result.current.problem).toBeUndefined();
  });

  it("sends a file with no caption", async () => {
    const send = connect();
    enterRoom();
    const { result } = renderHook(() => useSendChatFile(COHORT));

    await act(async () => {
      await result.current.sendFile(pdf(), "");
    });

    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: "say",
      text: "",
      attachment: ATTACHMENT,
    });
  });

  it("goes only where a call is held, and does no work in the corridors", async () => {
    connect();
    const { result } = renderHook(() => useSendChatFile(COHORT));
    expect(result.current.canAttach).toBe(false);

    let sent = true;
    await act(async () => {
      sent = await result.current.sendFile(pdf(), "");
    });

    expect(sent).toBe(false);
    expect(result.current.problem).toBe(NO_CALL_SPACE_MESSAGE);
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it.each([
    ["while the file uploads", "upload"],
    ["while it is tied to the call", "attach"],
  ] as const)("says nothing when the member walks out %s", async (_, when) => {
    const send = connect();
    enterRoom();
    const walkOut = () =>
      applyFrame(COHORT, {
        type: "spaceChanged",
        userId: serverFrames.welcome.userId,
        spaceKey: "library",
      });
    if (when === "upload") {
      vi.mocked(uploadMedia).mockImplementation(async () => {
        walkOut();
        return { kind: "uploaded", mediaId: "m-1" };
      });
    } else {
      vi.mocked(attachToCall).mockImplementation(async () => {
        walkOut();
        return { kind: "attached", attachment: ATTACHMENT };
      });
    }
    const { result } = renderHook(() => useSendChatFile(COHORT));

    await act(async () => {
      await result.current.sendFile(pdf(), "");
    });

    expect(result.current.problem).toBe(MOVED_SPACE_MESSAGE);
    expect(send).not.toHaveBeenCalled();
    expect(attachToCall).toHaveBeenCalledTimes(when === "upload" ? 0 : 1);
  });

  it("sends nothing when cancelled after the upload finished", async () => {
    const send = connect();
    enterRoom();
    const { result } = renderHook(() => useSendChatFile(COHORT));
    vi.mocked(attachToCall).mockImplementation(async () => {
      result.current.cancel();
      return { kind: "attached", attachment: ATTACHMENT };
    });

    let sent = true;
    await act(async () => {
      sent = await result.current.sendFile(pdf(), "");
    });

    expect(sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(result.current.problem).toBeUndefined();
  });

  it("can attach once the space's call is known", () => {
    enterRoom();
    const { result } = renderHook(() => useSendChatFile(COHORT));

    expect(result.current.canAttach).toBe(true);
  });

  it("does no work while the socket is down", async () => {
    enterRoom();
    act(() => presenceFor(COHORT).getState().clearRemoteParticipants());
    const { result } = renderHook(() => useSendChatFile(COHORT));

    await act(async () => {
      await result.current.sendFile(pdf(), "");
    });

    expect(result.current.problem).toBe("Reconnecting…");
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it("does no work when the next line could not go out", async () => {
    connect();
    enterRoom();
    const { result } = renderHook(() => useSendChatFile(COHORT));
    for (let line = 0; line < 5; line += 1) {
      await act(async () => {
        await result.current.sendFile(pdf(), "");
      });
    }
    vi.mocked(uploadMedia).mockClear();

    await act(async () => {
      await result.current.sendFile(pdf(), "");
    });

    expect(result.current.problem).toBe(
      "You're sending too fast. Try again in a moment.",
    );
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it.each([
    [
      { kind: "type-not-allowed", allowed: ["image/png"] },
      "That file's format isn't supported. Choose an image, PDF, Word, Excel or PowerPoint file.",
    ],
    [
      { kind: "too-large", maxBytes: 26_214_400 },
      "That file is over 25 MB. Choose a smaller one.",
    ],
    [
      { kind: "too-large", maxBytes: 0 },
      "That file is too big. Choose a smaller one.",
    ],
    [
      { kind: "rate-limited" },
      "You've uploaded a lot just now. Wait a few minutes and try again.",
    ],
    [
      { kind: "unavailable" },
      "We couldn't upload your file. Check your connection and try again.",
    ],
  ] satisfies Array<[UploadProblem, string]>)(
    "explains an upload that %j",
    async (problem, message) => {
      const send = connect();
      enterRoom();
      vi.mocked(uploadMedia).mockResolvedValue({ kind: "problem", problem });
      const { result } = renderHook(() => useSendChatFile(COHORT));

      let sent = true;
      await act(async () => {
        sent = await result.current.sendFile(pdf(), "kept");
      });

      expect(sent).toBe(false);
      expect(result.current.problem).toBe(message);
      expect(attachToCall).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
      expect(result.current.activity).toEqual({ kind: "idle" });
    },
  );

  it("says nothing for an upload the member cancelled", async () => {
    connect();
    enterRoom();
    vi.mocked(uploadMedia).mockResolvedValue({
      kind: "problem",
      problem: { kind: "cancelled" },
    });
    const { result } = renderHook(() => useSendChatFile(COHORT));

    await act(async () => {
      await result.current.sendFile(pdf(), "");
    });

    expect(result.current.problem).toBeUndefined();
  });

  it("sends a signed-out member to sign in", async () => {
    connect();
    enterRoom();
    vi.mocked(uploadMedia).mockResolvedValue({
      kind: "problem",
      problem: { kind: "signed-out" },
    });
    const { result } = renderHook(() => useSendChatFile(COHORT));

    await act(async () => {
      await result.current.sendFile(pdf(), "");
    });

    expect(replaceDocument).toHaveBeenCalledOnce();
    expect(result.current.problem).toBeUndefined();
  });

  it.each([
    ["no-call", "Files can be sent while a call is going on in this space."],
    ["not-allowed", "You can't send files in this space."],
    ["not-sent", "Your file didn't finish uploading. Try again."],
    [
      "unavailable",
      "We couldn't send your file. Check your connection and try again.",
    ],
  ] as const)(
    "explains a file the call would not take (%s)",
    async (problem, message) => {
      const send = connect();
      enterRoom();
      vi.mocked(attachToCall).mockResolvedValue({ kind: "problem", problem });
      const { result } = renderHook(() => useSendChatFile(COHORT));

      await act(async () => {
        await result.current.sendFile(pdf(), "");
      });

      expect(result.current.problem).toBe(message);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("sends a signed-out member to sign in when the call asks", async () => {
    connect();
    enterRoom();
    vi.mocked(attachToCall).mockResolvedValue({
      kind: "problem",
      problem: "signed-out",
    });
    const { result } = renderHook(() => useSendChatFile(COHORT));

    await act(async () => {
      await result.current.sendFile(pdf(), "");
    });

    expect(replaceDocument).toHaveBeenCalledOnce();
  });

  it("reports the upload's progress, then the wait for the call", async () => {
    connect();
    enterRoom();
    let report: (fraction: number) => void = () => {};
    let finish: (value: {
      kind: "uploaded";
      mediaId: string;
    }) => void = () => {};
    vi.mocked(uploadMedia).mockImplementation(({ onProgress }) => {
      report = onProgress ?? report;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    let attach: (
      value: Awaited<ReturnType<typeof attachToCall>>,
    ) => void = () => {};
    vi.mocked(attachToCall).mockReturnValue(
      new Promise((resolve) => {
        attach = resolve;
      }),
    );
    const { result } = renderHook(() => useSendChatFile(COHORT));

    let done: Promise<boolean> = Promise.resolve(false);
    act(() => {
      done = result.current.sendFile(pdf(), "");
    });
    await waitFor(() =>
      expect(result.current.activity).toEqual({
        kind: "uploading",
        fileName: "plan.pdf",
        progress: 0,
      }),
    );

    act(() => report(0.4));
    expect(result.current.activity).toMatchObject({ progress: 0.4 });

    act(() => finish({ kind: "uploaded", mediaId: "m-1" }));
    await waitFor(() =>
      expect(result.current.activity).toEqual({
        kind: "attaching",
        fileName: "plan.pdf",
      }),
    );

    await act(async () => {
      attach({ kind: "attached", attachment: ATTACHMENT });
      await done;
    });
    expect(result.current.activity).toEqual({ kind: "idle" });
  });

  it("can cancel the upload", async () => {
    connect();
    enterRoom();
    let signal: AbortSignal | undefined;
    vi.mocked(uploadMedia).mockImplementation(({ signal: given }) => {
      signal = given;
      return new Promise(() => {});
    });
    const { result } = renderHook(() => useSendChatFile(COHORT));
    act(() => {
      void result.current.sendFile(pdf(), "");
    });
    await waitFor(() => expect(result.current.activity.kind).toBe("uploading"));
    expect(signal?.aborted).toBe(false);

    act(() => result.current.cancel());

    expect(signal?.aborted).toBe(true);
  });

  it("does not start a second file while one is being sent", async () => {
    connect();
    enterRoom();
    vi.mocked(uploadMedia).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSendChatFile(COHORT));
    act(() => {
      void result.current.sendFile(pdf(), "");
    });
    await waitFor(() => expect(result.current.activity.kind).toBe("uploading"));

    let second = true;
    await act(async () => {
      second = await result.current.sendFile(pdf(), "");
    });

    expect(second).toBe(false);
    expect(uploadMedia).toHaveBeenCalledOnce();
  });
});
