import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/shared/ui/toast";

import { readFileLink } from "../services/chat/chat-attachment-api.adapter";
import {
  getGoneFileIdsSnapshot,
  setChatDraft,
} from "../store/chat-panel-store";
import { useOpenChatFile } from "./use-open-chat-file";

const replaceDocument = vi.hoisted(() => vi.fn());

vi.mock("../services/chat/chat-attachment-api.adapter", () => ({
  readFileLink: vi.fn(),
}));
vi.mock("@/shared/lib/document-navigation", () => ({ replaceDocument }));

const FILE = {
  mediaId: "m-1",
  fileName: "plan.pdf",
  contentType: "application/pdf",
  sizeBytes: 12,
};
const LINK = "https://storage.example.test/signed?token=abc";

function fakeTab() {
  return {
    close: vi.fn(),
    location: { href: "about:blank" },
    opener: {} as unknown,
  };
}

let open: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  open = vi.spyOn(window, "open");
});

afterEach(() => {
  open.mockRestore();
  vi.mocked(readFileLink).mockReset();
  replaceDocument.mockReset();
  setChatDraft("c-1", "");
});

describe("useOpenChatFile", () => {
  it("opens a tab in the click and gives it the fresh link, cut off from the page", async () => {
    const tab = fakeTab();
    open.mockReturnValue(tab as unknown as Window);
    vi.mocked(readFileLink).mockResolvedValue({ kind: "link", url: LINK });
    const { result } = renderHook(() => useOpenChatFile());

    await act(() => result.current.open(FILE));

    expect(open).toHaveBeenCalledExactlyOnceWith("", "_blank");
    expect(readFileLink).toHaveBeenCalledWith(expect.anything(), "m-1");
    expect(tab.location.href).toBe(LINK);
    expect(tab.opener).toBeNull();
    expect(tab.close).not.toHaveBeenCalled();
  });

  it("opens the link itself, with no opener, when a browser blocked the tab", async () => {
    open.mockReturnValueOnce(null);
    vi.mocked(readFileLink).mockResolvedValue({ kind: "link", url: LINK });
    const { result } = renderHook(() => useOpenChatFile());

    await act(() => result.current.open(FILE));

    expect(open).toHaveBeenLastCalledWith(
      LINK,
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("closes the tab and remembers a file the call let go", async () => {
    const tab = fakeTab();
    open.mockReturnValue(tab as unknown as Window);
    vi.mocked(readFileLink).mockResolvedValue({
      kind: "problem",
      problem: "gone",
    });
    const { result } = renderHook(() => useOpenChatFile());

    await act(() => result.current.open(FILE));

    expect(tab.close).toHaveBeenCalledOnce();
    expect(getGoneFileIdsSnapshot()).toContain("m-1");
  });

  it("sends a signed-out member to sign in", async () => {
    open.mockReturnValue(fakeTab() as unknown as Window);
    vi.mocked(readFileLink).mockResolvedValue({
      kind: "problem",
      problem: "signed-out",
    });
    const { result } = renderHook(() => useOpenChatFile());

    await act(() => result.current.open(FILE));

    expect(replaceDocument).toHaveBeenCalledOnce();
  });

  it("says so when the link cannot be had, and tries again on the next press", async () => {
    const addToast = vi.spyOn(toast, "add");
    const tab = fakeTab();
    open.mockReturnValue(tab as unknown as Window);
    vi.mocked(readFileLink).mockResolvedValue({
      kind: "problem",
      problem: "unavailable",
    });
    const { result } = renderHook(() => useOpenChatFile());

    await act(() => result.current.open(FILE));

    expect(tab.close).toHaveBeenCalledOnce();
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "We couldn't open that file" }),
    );
    expect(result.current.opening).toBeNull();
    addToast.mockRestore();
  });

  it("does not blame the connection for a file the member may not have", async () => {
    const addToast = vi.spyOn(toast, "add");
    open.mockReturnValue(fakeTab() as unknown as Window);
    vi.mocked(readFileLink).mockResolvedValue({
      kind: "problem",
      problem: "not-found",
    });
    const { result } = renderHook(() => useOpenChatFile());

    await act(() => result.current.open(FILE));

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "It was removed, or you can no longer enter the space it was sent in.",
      }),
    );
    addToast.mockRestore();
  });

  it("ignores a second press while a link is being fetched", async () => {
    open.mockReturnValue(fakeTab() as unknown as Window);
    let finish: (value: { kind: "link"; url: string }) => void = () => {};
    vi.mocked(readFileLink).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useOpenChatFile());

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.open(FILE);
    });
    expect(result.current.opening).toBe("m-1");
    await act(() => result.current.open(FILE));
    expect(readFileLink).toHaveBeenCalledOnce();

    await act(async () => {
      finish({ kind: "link", url: LINK });
      await first;
    });
    expect(result.current.opening).toBeNull();
  });
});
