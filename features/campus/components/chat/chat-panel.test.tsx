import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyFrame,
  callFrame,
  clearPresence,
  GRACE,
  seedPresence,
} from "@/tests/fixtures/nearby-presence";

import { useChatOpen } from "../../hooks/use-chat-panel";
import type { MeetingMediaTransport } from "../../services/media-session/contracts";
import { MediaSessionProvider } from "../../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../../services/media-session/media-session-store";
import {
  closeChat,
  getChatOpenSnapshot,
  getChatTabSnapshot,
  openChat,
  setChatTab,
} from "../../store/chat-panel-store";
import { ChatPanel } from "./chat-panel";
import { ChatToggleButton } from "./chat-toggle-button";

const COHORT_ID = "chat-panel-cohort";

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

function OpenState() {
  return <output data-testid="open">{String(useChatOpen())}</output>;
}

function renderChat() {
  return render(
    <MotionConfig reducedMotion="always">
      <MediaSessionProvider store={mediaStore()}>
        <ChatToggleButton />
        <ChatPanel cohortId={COHORT_ID} />
        <OpenState />
      </MediaSessionProvider>
    </MotionConfig>,
  );
}

beforeEach(() => {
  seedPresence(COHORT_ID, GRACE);
});

afterEach(() => {
  act(() => {
    closeChat();
    setChatTab("chat");
  });
  clearPresence(COHORT_ID);
});

describe("ChatPanel", () => {
  it("is not there until chat is opened", () => {
    renderChat();

    expect(
      screen.queryByRole("complementary", { name: "Meeting chat" }),
    ).toBeNull();
  });

  it("opens from the control bar button and closes from it", () => {
    renderChat();
    const toggle = screen.getByRole("button", { name: "Open chat" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);

    expect(
      screen.getByRole("complementary", { name: "Meeting chat" }),
    ).toBeInTheDocument();
    const open = screen.getByRole("button", {
      name: "Close chat",
      expanded: true,
    });
    expect(open).toHaveAttribute("aria-controls", "meeting-chat");
    expect(screen.getByTestId("open")).toHaveTextContent("true");
  });

  it("offers the Chat, People and Resources tabs, with the people counted", () => {
    renderChat();
    act(() => openChat());

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Chat",
      "People2",
      "Resources",
    ]);
    expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("moves focus onto the open tab when it opens", async () => {
    renderChat();

    act(() => openChat());

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Chat" })).toHaveFocus(),
    );
  });

  it("lists the people in the meeting on the People tab, the member first", () => {
    renderChat();
    act(() => openChat("people"));

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("You");
    expect(rows[1]).toHaveTextContent("Grace Hopper");
    expect(screen.queryByText("Nobody else is here.")).toBeNull();
  });

  it("says nobody else is here when the member is alone", () => {
    seedPresence(COHORT_ID);
    renderChat();
    act(() => openChat("people"));

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Nobody else is here.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /People/ })).toHaveTextContent("1");
  });

  it("shows a placeholder on the Chat and Resources tabs for now", () => {
    renderChat();
    act(() => openChat());
    expect(screen.getByText("Chat is coming soon.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Resources" }));
    expect(screen.getByText("Resources is coming soon.")).toBeInTheDocument();
    expect(getChatTabSnapshot()).toBe("resources");
  });

  it("closes from its close button and hands focus back to the control bar button", async () => {
    renderChat();
    act(() => openChat());

    const panel = screen.getByRole("complementary", { name: "Meeting chat" });
    fireEvent.click(within(panel).getByRole("button", { name: "Close chat" }));
    await waitFor(() => expect(getChatOpenSnapshot()).toBe(false));

    expect(screen.getByRole("button", { name: "Open chat" })).toHaveFocus();
  });

  it("closes on Escape from inside the panel", async () => {
    renderChat();
    act(() => openChat());

    fireEvent.keyDown(screen.getByRole("tab", { name: "Chat" }), {
      key: "Escape",
    });

    await waitFor(() => expect(getChatOpenSnapshot()).toBe(false));
    expect(screen.getByRole("button", { name: "Open chat" })).toHaveFocus();
  });

  it("remembers the tab it showed when it opens again", () => {
    renderChat();
    act(() => openChat("people"));
    act(() => closeChat());
    act(() => openChat());

    expect(screen.getByRole("tab", { name: /People/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("says people nearby in a corridor", () => {
    applyFrame(COHORT_ID, callFrame("proximity"));
    renderChat();
    act(() => openChat());

    expect(screen.getByText("People nearby")).toBeInTheDocument();
  });

  it("says everyone in the room in a room space", () => {
    applyFrame(COHORT_ID, callFrame("room"));
    renderChat();
    act(() => openChat());

    expect(screen.getByText(/Everyone in the room/)).toBeInTheDocument();
  });
});
