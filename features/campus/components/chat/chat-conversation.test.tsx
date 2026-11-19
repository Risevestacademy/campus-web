import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { presenceFor } from "@/core/presence";
import type { ServerMessage } from "@/core/realtime";
import { socialFor } from "@/core/realtime";
import {
  ADA,
  applyFrame,
  clearPresence,
  GRACE,
  seedPresence,
} from "@/tests/fixtures/nearby-presence";
import { serverFrames } from "@/tests/fixtures/world-frames";

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

const COHORT = "chat-conversation-cohort";
const SPACE = "_default";

function said(
  id: string,
  userId: string,
  text: string,
  at = "2026-11-17T15:01:10.000Z",
): ServerMessage {
  return { ...serverFrames.said, id, userId, spaceKey: SPACE, text, at };
}

function hear(...frames: ServerMessage[]) {
  act(() => frames.forEach((frame) => applyFrame(COHORT, frame)));
}

let unbind = () => {};

function connectSocial(accepts = true) {
  const send = vi.fn(() => accepts);
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

function box() {
  return screen.getByRole("textbox", { name: /^Message/ });
}

function type(text: string) {
  fireEvent.change(box(), { target: { value: text } });
}

beforeEach(() => {
  seedPresence(COHORT, GRACE);
});

afterEach(() => {
  act(() => {
    closeChat();
    setChatTab("chat");
    setChatDraft("");
    markChatReadThrough(null);
  });
  unbind();
  clearPresence(COHORT);
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("the Chat tab", () => {
  it("says messages are not saved, and that nothing has been said yet", () => {
    renderChat();
    act(() => openChat());

    expect(
      screen.getByText(
        "Messages aren't saved. People who join later won't see these.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("No messages yet. Say hello.")).toBeInTheDocument();
    expect(screen.getByText(/^You joined/)).toBeInTheDocument();
  });

  it("shows what people say, naming the member's own lines You", () => {
    renderChat();
    act(() => openChat());

    hear(
      said("1", GRACE.userId, "Sharing my screen in a sec"),
      said("2", ADA.userId, "Sounds good", "2026-11-17T15:03:10.000Z"),
    );

    const log = screen.getByRole("log", { name: "Messages" });
    expect(within(log).getByText("Sharing my screen in a sec")).toBeVisible();
    expect(within(log).getByText("Grace Hopper")).toBeInTheDocument();
    expect(within(log).getByText("You")).toBeInTheDocument();
    expect(within(log).queryByText("No messages yet. Say hello.")).toBeNull();
  });

  it("puts one person's lines from the same minute under one header", () => {
    renderChat();
    act(() => openChat());

    hear(
      said("1", GRACE.userId, "First", "2026-11-17T15:01:05.000Z"),
      said("2", GRACE.userId, "Second", "2026-11-17T15:01:40.000Z"),
      said("3", GRACE.userId, "Third", "2026-11-17T15:02:05.000Z"),
    );

    const log = screen.getByRole("log", { name: "Messages" });
    expect(within(log).getAllByText("Grace Hopper")).toHaveLength(2);
    expect(within(log).getByText("Second")).toBeInTheDocument();
  });

  it("keeps a speaker's name after they leave", () => {
    renderChat();
    act(() => openChat());

    hear(said("1", GRACE.userId, "Bye for now"), {
      type: "left",
      userId: GRACE.userId,
    });

    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });

  it("draws text as text, never as markup", () => {
    renderChat();
    act(() => openChat());

    hear(said("1", GRACE.userId, '<img src=x onerror="alert(1)"> <b>bold</b>'));

    const log = screen.getByRole("log", { name: "Messages" });
    expect(log.querySelector("img")).toBeNull();
    expect(log.querySelector("b")).toBeNull();
    expect(within(log).getByText(/<b>bold<\/b>/)).toBeInTheDocument();
  });

  it("starts over for the space the member walks into", () => {
    renderChat();
    act(() => openChat());
    hear(said("1", GRACE.userId, "Said in the corridor"));

    hear({
      type: "spaceChanged",
      userId: ADA.userId,
      spaceKey: "library",
    });

    expect(screen.queryByText("Said in the corridor")).toBeNull();
    expect(screen.getByText("No messages yet. Say hello.")).toBeInTheDocument();
  });

  it("keeps what was said, and the draft, while the panel is closed", () => {
    renderChat();
    act(() => openChat());
    type("not sent yet");
    hear(said("1", GRACE.userId, "While you were away"));

    act(() => closeChat());
    act(() => openChat());

    expect(box()).toHaveValue("not sent yet");
    expect(screen.getByText("While you were away")).toBeInTheDocument();
  });

  it("keeps nothing said in browser storage", () => {
    connectSocial();
    renderChat();
    act(() => openChat());
    hear(said("1", GRACE.userId, "A private word"));
    type("and a reply");
    fireEvent.keyDown(box(), { key: "Enter" });

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});

describe("the composer", () => {
  it("names the room, or people nearby, in its placeholder", () => {
    renderChat();
    act(() => openChat());

    expect(box()).toHaveAttribute("placeholder", "Message people nearby");
  });

  it("sends on Enter, trims the line and clears the box", () => {
    const send = connectSocial();
    renderChat();
    act(() => openChat());

    type("  Hello everyone  ");
    fireEvent.keyDown(box(), { key: "Enter" });

    expect(send).toHaveBeenCalledWith({ type: "say", text: "Hello everyone" });
    expect(box()).toHaveValue("");
  });

  it("sends from the button too", () => {
    const send = connectSocial();
    renderChat();
    act(() => openChat());

    type("From the button");
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(send).toHaveBeenCalledOnce();
  });

  it("adds a line on Shift+Enter and sends nothing", () => {
    const send = connectSocial();
    renderChat();
    act(() => openChat());

    type("one");
    fireEvent.keyDown(box(), { key: "Enter", shiftKey: true });

    expect(send).not.toHaveBeenCalled();
    expect(box()).toHaveValue("one");
  });

  it("does not send an empty or blank line", () => {
    const send = connectSocial();
    renderChat();
    act(() => openChat());
    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).toBeDisabled();

    type("    ");
    fireEvent.keyDown(box(), { key: "Enter" });

    expect(sendButton).toBeDisabled();
    expect(send).not.toHaveBeenCalled();
  });

  it("shows the count near the limit and refuses a line over it", () => {
    const send = connectSocial();
    renderChat();
    act(() => openChat());

    type("x".repeat(399));
    expect(screen.queryByText("399/500")).toBeNull();

    type("x".repeat(412));
    expect(screen.getByText("412/500")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();

    type("x".repeat(501));
    expect(screen.getByText("501/500")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(send).not.toHaveBeenCalled();
    expect(box()).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps the text and says so when the sixth line comes too fast", () => {
    const send = connectSocial();
    renderChat();
    act(() => openChat());
    for (let line = 0; line < 5; line += 1) {
      type(`line ${line}`);
      fireEvent.keyDown(box(), { key: "Enter" });
    }

    type("too soon");
    fireEvent.keyDown(box(), { key: "Enter" });

    expect(send).toHaveBeenCalledTimes(5);
    expect(box()).toHaveValue("too soon");
    expect(
      screen.getByText("You're sending too fast. Try again in a moment."),
    ).toBeInTheDocument();

    type("too soon, still");
    expect(
      screen.queryByText("You're sending too fast. Try again in a moment."),
    ).toBeNull();
  });

  it("keeps the text and says Reconnecting… when the socket cannot send", () => {
    connectSocial(false);
    renderChat();
    act(() => openChat());

    type("Is anybody there");
    fireEvent.keyDown(box(), { key: "Enter" });

    expect(box()).toHaveValue("Is anybody there");
    expect(screen.getByText("Reconnecting…")).toBeInTheDocument();
  });

  it("disables Send and says Reconnecting… while the socket is down", () => {
    connectSocial();
    renderChat();
    act(() => openChat());
    expect(screen.queryByText("Reconnecting…")).toBeNull();

    act(() => presenceFor(COHORT).getState().clearRemoteParticipants());

    expect(screen.getByText("Reconnecting…")).toBeInTheDocument();
    type("Typed while it was down");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(box()).toHaveValue("Typed while it was down");
  });

  it("holds a place for files, switched off until they are supported", () => {
    renderChat();
    act(() => openChat());

    expect(
      screen.getByRole("button", { name: "Attach a file" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});

describe("unread", () => {
  it("counts what others say while chat is closed, on the control bar button", () => {
    renderChat();
    expect(
      screen.getByRole("button", { name: "Open chat" }),
    ).toBeInTheDocument();

    hear(said("1", GRACE.userId, "One"), said("2", GRACE.userId, "Two"));

    const button = screen.getByRole("button", { name: "Open chat, 2 unread" });
    expect(within(button).getByText("2")).toBeInTheDocument();
  });

  it("does not count the member's own lines", () => {
    renderChat();

    hear(said("1", ADA.userId, "Mine"));

    expect(
      screen.getByRole("button", { name: "Open chat" }),
    ).toBeInTheDocument();
  });

  it("caps the badge at 99+", () => {
    renderChat();

    hear(
      ...Array.from({ length: 120 }, (_, index) =>
        said(String(index), GRACE.userId, "Hi"),
      ),
    );

    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open chat, 120 unread" }),
    ).toBeInTheDocument();
  });

  it("clears once the Chat tab has been shown", () => {
    renderChat();
    hear(said("1", GRACE.userId, "One"));
    expect(
      screen.getByRole("button", { name: "Open chat, 1 unread" }),
    ).toBeInTheDocument();

    act(() => openChat());
    act(() => closeChat());

    expect(
      screen.getByRole("button", { name: "Open chat" }),
    ).toBeInTheDocument();
  });

  it("reads what arrives while the Chat tab is showing", () => {
    renderChat();
    act(() => openChat());

    hear(said("1", GRACE.userId, "Said while you looked"));
    act(() => closeChat());

    expect(
      screen.getByRole("button", { name: "Open chat" }),
    ).toBeInTheDocument();
  });

  it("marks a dot on the Chat tab when lines arrive on another tab", () => {
    renderChat();
    act(() => openChat("people"));

    hear(said("1", GRACE.userId, "One"));

    const tab = screen.getByRole("tab", { name: /new messages/ });
    expect(tab).toHaveTextContent("Chat");

    fireEvent.click(tab);
    expect(screen.getByRole("tab", { name: "Chat" })).toBeInTheDocument();
  });
});
