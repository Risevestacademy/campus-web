"use client";

import { ArrowDownIcon } from "@phosphor-icons/react/dist/ssr/ArrowDown";
import { type UIEvent, useMemo, useRef, useState } from "react";

import { Button } from "@/shared/ui/button";

import {
  type ChatMessage,
  formatChatTime,
  groupMessages,
} from "../../services/chat/chat-messages";
import { ChatMessageGroup } from "./chat-message-group";

// Further than this from the newest line counts as reading back.
const AT_BOTTOM_PX = 48;

// The lines said in the space. The list is laid out from the bottom up, so it
// rests on the newest line and stays there as more arrive, with no code
// moving it; a member who scrolled back up is told, not pulled down.
export function ChatMessageList({
  enteredAt,
  messages,
}: Readonly<{ enteredAt: number | null; messages: readonly ChatMessage[] }>) {
  const scroller = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupMessages(messages), [messages]);
  // How many lines there were when the member scrolled up, or null at the end.
  const [countWhenAway, setCountWhenAway] = useState<number | null>(null);
  const hasNew = countWhenAway !== null && messages.length > countWhenAway;

  function onScroll(event: UIEvent<HTMLDivElement>) {
    // Scrolling is measured from the bottom: 0 is the newest line.
    const away = -event.currentTarget.scrollTop > AT_BOTTOM_PX;
    setCountWhenAway((previous) =>
      away ? (previous ?? messages.length) : null,
    );
  }

  function jumpToNewest() {
    scroller.current?.scrollTo({ top: 0 });
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-label="Messages"
        tabIndex={0}
        onScroll={onScroll}
        className="focus-visible:ring-ring/50 flex min-h-0 flex-1 flex-col-reverse overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <div className="flex flex-col gap-3 px-4 py-3">
          <p className="bg-surface-hover text-foreground-secondary self-center rounded-full px-3 py-0.5 text-xs">
            {enteredAt === null
              ? "You joined"
              : `You joined · ${formatChatTime(enteredAt)}`}
          </p>
          {groups.length === 0 ? (
            <p className="text-foreground-secondary py-6 text-center text-sm">
              No messages yet. Say hello.
            </p>
          ) : (
            groups.map((group) => (
              <ChatMessageGroup key={group.key} group={group} />
            ))
          )}
        </div>
      </div>
      {hasNew ? (
        <Button
          type="button"
          size="xs"
          onClick={jumpToNewest}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 shadow-md"
        >
          <ArrowDownIcon aria-hidden />
          New messages
        </Button>
      ) : null}
    </div>
  );
}
