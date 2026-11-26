import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServerMessage } from "@/core/realtime";
import { socialFor } from "@/core/realtime";
import { uploadMedia } from "@/core/uploads";
import {
  ADA,
  applyFrame,
  clearPresence,
  GRACE,
  seedPresence,
} from "@/tests/fixtures/nearby-presence";
import { serverFrames } from "@/tests/fixtures/world-frames";

import {
  attachToCall,
  readFileLink,
} from "../../services/chat/chat-attachment-api.adapter";
import { resetSendBudgets } from "../../services/chat/send-budget";
import type { MeetingMediaTransport } from "../../services/media-session/contracts";
import { MediaSessionProvider } from "../../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../../services/media-session/media-session-store";
import {
  closeChat,
  markChatReadThrough,
  openChat,
  setChatDraft,
  setChatTab,
} from "../../store/chat-panel-store";
import { ChatPanel } from "./chat-panel";
import { ChatToggleButton } from "./chat-toggle-button";

vi.mock("@/core/uploads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/uploads")>()),
  uploadMedia: vi.fn(),
}));
vi.mock("../../services/chat/chat-attachment-api.adapter", () => ({
  attachToCall: vi.fn(),
  readFileLink: vi.fn(),
}));

const COHORT = "chat-files-cohort";
const COHORT_ID = "11111111-1111-4111-8111-111111111111";
const SPACE_ID = "7c2f0a64-93d1-4a52-a5d7-0b6c9f4c2e11";
const SPACE = "_default";
const PLAN = {
  mediaId: "m-plan",
  fileName: "onboarding-flow.pdf",
  contentType: "application/pdf",
  sizeBytes: 1_234_567,
};
// Marked gone for the rest of the session, so no other test uses it.
const LET_GO = { ...PLAN, mediaId: "m-let-go" };
const PHOTO = {
  mediaId: "m-photo",
  fileName: null,
  contentType: "image/png",
  sizeBytes: 48_213,
};

function said(
  id: string,
  userId: string,
  text: string,
  attachment: typeof PLAN | typeof PHOTO | null,
  at = "2026-11-17T15:01:10.000Z",
): ServerMessage {
  return {
    ...serverFrames.said,
    id,
    userId,
    spaceKey: SPACE,
    text,
    attachment,
    at,
  };
}

function hear(...frames: ServerMessage[]) {
  act(() => frames.forEach((frame) => applyFrame(COHORT, frame)));
}

function enterRoom() {
  act(() =>
    applyFrame(COHORT, {
      type: "call",
      call: {
        url: "wss://media.example.test",
        token: "media-token",
        hearing: "room",
        audibleRadius: 6,
        room: `space:${COHORT_ID}:${SPACE_ID}`,
      },
    }),
  );
}

let unbind = () => {};

function connectSocial() {
  const send = vi.fn(() => true);
  const social = socialFor(COHORT);
  unbind = social.bind(send);
  social.apply(serverFrames.welcome);
  social.apply(serverFrames.snapshot);
  return send;
}

function mediaStore() {
  const transport: MeetingMediaTransport = {
    connect: () => () => undefined,
    handleLocalPublicationChange() {},
    retry() {},
    setBroadcastSpeaking() {},
    setVideoDemand() {},
  };
  return createMediaSessionStore({ mediaDevices: null, transport });
}

function renderChat() {
  return render(
    <MotionConfig reducedMotion="always">
      <MediaSessionProvider store={mediaStore()}>
        <ChatToggleButton cohortId={COHORT} />
        <ChatPanel cohortId={COHORT} />
      </MediaSessionProvider>
    </MotionConfig>,
  );
}

function log() {
  return screen.getByRole("log", { name: "Messages" });
}

function chooseFile(file: File) {
  const input = screen.getByLabelText("Choose a file to send");
  fireEvent.change(input, { target: { files: [file] } });
}

const pdf = () => new File(["x"], "plan.pdf", { type: "application/pdf" });

beforeEach(() => {
  seedPresence(COHORT, GRACE);
  vi.mocked(uploadMedia).mockResolvedValue({
    kind: "uploaded",
    mediaId: "m-1",
  });
  vi.mocked(attachToCall).mockResolvedValue({
    kind: "attached",
    attachment: PLAN,
  });
});

afterEach(() => {
  act(() => {
    closeChat();
    setChatTab("chat");
    setChatDraft(COHORT, "");
    markChatReadThrough(COHORT, null);
    resetSendBudgets();
  });
  unbind();
  clearPresence(COHORT);
  vi.mocked(uploadMedia).mockReset();
  vi.mocked(attachToCall).mockReset();
  vi.mocked(readFileLink).mockReset();
  vi.restoreAllMocks();
});

describe("a file in the conversation", () => {
  it("shows what it is, how big, and its caption", () => {
    renderChat();
    act(() => openChat());

    hear(said("1", GRACE.userId, "The onboarding flow", PLAN));

    expect(within(log()).getByText("The onboarding flow")).toBeVisible();
    expect(within(log()).getByText("onboarding-flow.pdf")).toBeVisible();
    expect(within(log()).getByText("1.2 MB")).toBeVisible();
    expect(
      within(log()).getByRole("button", { name: "Open onboarding-flow.pdf" }),
    ).toBeEnabled();
  });

  it("shows a file sent with no caption, with no empty line above it", () => {
    renderChat();
    act(() => openChat());

    hear(said("1", GRACE.userId, "", PHOTO));

    expect(within(log()).getByText("File")).toBeVisible();
    expect(within(log()).getByText("47 KB")).toBeVisible();
    expect(log().querySelectorAll("p:empty")).toHaveLength(0);
  });

  it("opens the file through a fresh link", async () => {
    const tab = { close: vi.fn(), location: { href: "" }, opener: {} };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    vi.mocked(readFileLink).mockResolvedValue({
      kind: "link",
      url: "https://storage.example.test/signed?token=abc",
    });
    renderChat();
    act(() => openChat());
    hear(said("1", GRACE.userId, "", PLAN));

    fireEvent.click(
      within(log()).getByRole("button", { name: "Open onboarding-flow.pdf" }),
    );

    await waitFor(() =>
      expect(tab.location.href).toBe(
        "https://storage.example.test/signed?token=abc",
      ),
    );
    expect(readFileLink).toHaveBeenCalledWith(expect.anything(), "m-plan");
  });

  it("says a file is no longer available once the call ended, here and in Resources", async () => {
    const tab = { close: vi.fn(), location: { href: "" }, opener: {} };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    vi.mocked(readFileLink).mockResolvedValue({
      kind: "problem",
      problem: "gone",
    });
    renderChat();
    act(() => openChat());
    hear(said("1", GRACE.userId, "", LET_GO));

    fireEvent.click(
      within(log()).getByRole("button", { name: "Open onboarding-flow.pdf" }),
    );

    const notice =
      "This file is no longer available. Files close when the call ends.";
    expect(await within(log()).findByText(notice)).toBeVisible();
    expect(within(log()).queryByRole("button", { name: /^Open / })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Resources/ }));
    expect(screen.getByText(notice)).toBeVisible();
  });
});

describe("the Resources tab", () => {
  it("says there are no files yet", () => {
    renderChat();
    act(() => {
      setChatTab("resources");
      openChat();
    });

    expect(
      screen.getByText(
        "No files yet. Files sent in this meeting show up here.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: /Resources/ })).toHaveTextContent(
      "Resources0",
    );
  });

  it("lists the files sent, newest first, with who sent each and a count", () => {
    renderChat();
    act(() => {
      setChatTab("resources");
      openChat();
    });

    hear(
      said("1", GRACE.userId, "", PLAN, "2026-11-17T15:01:10.000Z"),
      said("2", GRACE.userId, "Only words", null, "2026-11-17T15:02:10.000Z"),
      said("3", ADA.userId, "", PHOTO, "2026-11-17T15:03:10.000Z"),
    );

    expect(screen.getByRole("tab", { name: /Resources/ })).toHaveTextContent(
      "Resources2",
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("File");
    expect(items[0]).toHaveTextContent("You");
    expect(items[1]).toHaveTextContent("onboarding-flow.pdf");
    expect(items[1]).toHaveTextContent("Grace Hopper");
  });

  it("opens a file from the list", async () => {
    const tab = { close: vi.fn(), location: { href: "" }, opener: {} };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    vi.mocked(readFileLink).mockResolvedValue({
      kind: "link",
      url: "https://storage.example.test/x",
    });
    renderChat();
    act(() => {
      setChatTab("resources");
      openChat();
    });
    hear(said("1", GRACE.userId, "", PLAN));

    fireEvent.click(
      screen.getByRole("button", { name: "Open onboarding-flow.pdf" }),
    );

    await waitFor(() =>
      expect(tab.location.href).toBe("https://storage.example.test/x"),
    );
  });

  it("starts over when the member walks into another space", () => {
    renderChat();
    act(() => {
      setChatTab("resources");
      openChat();
    });
    hear(said("1", GRACE.userId, "", PLAN));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    hear({ type: "spaceChanged", userId: ADA.userId, spaceKey: "library" });

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(
      screen.getByText(
        "No files yet. Files sent in this meeting show up here.",
      ),
    ).toBeVisible();
  });

  it("counts a file as unread, like any line", () => {
    renderChat();

    hear(said("1", GRACE.userId, "", PLAN));

    expect(
      screen.getByRole("button", { name: "Open chat, 1 unread" }),
    ).toBeInTheDocument();
  });
});

describe("sending a file from the composer", () => {
  it("sends the picked file with what is typed, and clears the box", async () => {
    const send = connectSocial();
    enterRoom();
    renderChat();
    act(() => openChat());
    fireEvent.change(screen.getByRole("textbox", { name: /^Message/ }), {
      target: { value: "Here it is" },
    });

    chooseFile(pdf());

    await waitFor(() =>
      expect(send).toHaveBeenCalledExactlyOnceWith({
        type: "say",
        text: "Here it is",
        attachment: PLAN,
      }),
    );
    expect(screen.getByRole("textbox", { name: /^Message/ })).toHaveValue("");
  });

  it("opens the file picker from the paperclip in a room", () => {
    connectSocial();
    enterRoom();
    renderChat();
    act(() => openChat());
    const input = screen.getByLabelText("Choose a file to send");
    const click = vi.spyOn(input, "click");

    fireEvent.click(screen.getByRole("button", { name: "Attach a file" }));

    expect(click).toHaveBeenCalledOnce();
  });

  it("says files go in rooms, and opens no picker, in the corridors", () => {
    connectSocial();
    renderChat();
    act(() => openChat());
    const input = screen.getByLabelText("Choose a file to send");
    const click = vi.spyOn(input, "click");
    const attach = screen.getByRole("button", { name: "Attach a file" });
    expect(attach).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(attach);

    expect(click).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Files can be sent in meeting spaces, not in the corridors.",
      ),
    ).toBeVisible();
  });

  it("shows the upload, with a way to cancel it", async () => {
    connectSocial();
    enterRoom();
    let report: (fraction: number) => void = () => {};
    let signal: AbortSignal | undefined;
    vi.mocked(uploadMedia).mockImplementation(
      ({ onProgress, signal: given }) => {
        report = onProgress ?? report;
        signal = given;
        return new Promise(() => {});
      },
    );
    renderChat();
    act(() => openChat());

    chooseFile(pdf());

    expect(await screen.findByText("Uploading plan.pdf")).toBeVisible();
    act(() => report(0.6));
    expect(
      screen.getByRole("progressbar", { name: "Uploading your file" }),
    ).toHaveAttribute("aria-valuenow", "60");
    expect(
      screen.getByRole("button", { name: "Attach a file" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }));

    expect(signal?.aborted).toBe(true);
  });

  it("says why a file could not be sent and keeps what was typed", async () => {
    connectSocial();
    enterRoom();
    vi.mocked(uploadMedia).mockResolvedValue({
      kind: "problem",
      problem: { kind: "too-large", maxBytes: 26_214_400 },
    });
    renderChat();
    act(() => openChat());
    fireEvent.change(screen.getByRole("textbox", { name: /^Message/ }), {
      target: { value: "Caption kept" },
    });

    chooseFile(pdf());

    expect(
      await screen.findByText("That file is over 25 MB. Choose a smaller one."),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: /^Message/ })).toHaveValue(
      "Caption kept",
    );
  });
});
