"use client";

import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { AnimatePresence, motion, useReducedMotionConfig } from "motion/react";
import { type KeyboardEvent, useRef } from "react";

import { useMountEffect } from "@/shared/lib/use-mount-effect";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsPanel, TabsPillList, TabsPillTab } from "@/shared/ui/tabs";

import { useChatOpen, useChatTab } from "../../hooks/use-chat-panel";
import { useChatPeople } from "../../hooks/use-chat-people";
import {
  CHAT_TABS,
  type ChatTab,
  closeChat,
  setChatTab,
} from "../../store/chat-panel-store";
import { SIDEBAR_WIDTH } from "../campus-shell/sidebar-width";
import { CHAT_PANEL_ID, focusChatToggle } from "./chat-ids";
import { PeopleTab } from "./people-tab";

// The sidebar's width, so swapping one for the other does not move the
// meeting.
const CHAT_PANEL_WIDTH = SIDEBAR_WIDTH;
const PANEL_TRANSITION = {
  type: "spring",
  stiffness: 420,
  damping: 42,
} as const;

function isChatTab(value: unknown): value is ChatTab {
  return CHAT_TABS.some((tab) => tab === value);
}

function ComingSoon({ what }: Readonly<{ what: string }>) {
  return (
    <div className="text-foreground-secondary grid flex-1 place-items-center p-6 text-center text-sm">
      {what} is coming soon.
    </div>
  );
}

function ChatPanelContent({ cohortId }: Readonly<{ cohortId: string }>) {
  const tab = useChatTab();
  const { hearing, localId, people, spaceName } = useChatPeople(cohortId);
  const panel = useRef<HTMLDivElement>(null);

  // Opening the panel moves focus into it, onto the tab that is showing.
  useMountEffect(() => {
    panel.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.focus();
  });

  function close() {
    closeChat();
    focusChatToggle();
  }

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key !== "Escape") return;

    event.stopPropagation();
    close();
  }

  return (
    <div
      ref={panel}
      role="presentation"
      onKeyDown={closeOnEscape}
      style={{ width: CHAT_PANEL_WIDTH }}
      className="flex h-full flex-col"
    >
      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (isChatTab(next)) setChatTab(next);
        }}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 p-3 pb-2">
          <TabsPillList aria-label="Chat sections">
            <TabsPillTab value="chat">Chat</TabsPillTab>
            <TabsPillTab value="people" count={people.length}>
              People
            </TabsPillTab>
            <TabsPillTab value="resources">Resources</TabsPillTab>
          </TabsPillList>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close chat"
            onClick={close}
            className="text-icon-muted hover:text-icon shrink-0"
          >
            <XIcon aria-hidden />
          </Button>
        </div>
        <p className="border-shell-line text-foreground-secondary shrink-0 border-b px-4 pb-2 text-xs">
          {hearing === "room"
            ? `${spaceName ?? "This room"} · Everyone in the room`
            : "People nearby"}
        </p>

        <TabsPanel value="chat" className="flex min-h-0 flex-col">
          <ComingSoon what="Chat" />
        </TabsPanel>
        <TabsPanel value="people" className="flex min-h-0 flex-col">
          <PeopleTab localId={localId} people={people} />
        </TabsPanel>
        <TabsPanel value="resources" className="flex min-h-0 flex-col">
          <ComingSoon what="Resources" />
        </TabsPanel>
      </Tabs>
    </div>
  );
}

// The chat panel, on the right of the campus. It is never open beside the
// sidebar: opening one closes the other.
export function ChatPanel({ cohortId }: Readonly<{ cohortId: string }>) {
  const open = useChatOpen();
  const reduceMotion = Boolean(useReducedMotionConfig());

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.aside
          key="chat-panel"
          id={CHAT_PANEL_ID}
          aria-label="Meeting chat"
          data-slot="chat-panel"
          initial={{ width: 0 }}
          animate={{ width: CHAT_PANEL_WIDTH }}
          exit={{ width: 0 }}
          transition={reduceMotion ? { duration: 0 } : PANEL_TRANSITION}
          className="bg-shell-panel border-shell-line shrink-0 overflow-hidden rounded-xl border"
        >
          <ChatPanelContent cohortId={cohortId} />
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
