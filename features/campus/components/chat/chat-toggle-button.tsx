"use client";

import { ChatIcon } from "@phosphor-icons/react/dist/ssr/Chat";
import { cn } from "cn";

import { Button } from "@/shared/ui/button";

import { useChatOpen } from "../../hooks/use-chat-panel";
import { useChatUnread } from "../../hooks/use-chat-unread";
import { toggleChat } from "../../store/chat-panel-store";
import { CHAT_PANEL_ID, CHAT_TOGGLE_ID } from "./chat-ids";

// Opens the chat panel, and closes it again. While it is open the sidebar
// gives way, so the meeting keeps its room.
export function ChatToggleButton({
  className,
  cohortId,
}: Readonly<{ className?: string; cohortId: string }>) {
  const open = useChatOpen();
  const unread = useChatUnread(cohortId);
  const label = open
    ? "Close chat"
    : unread > 0
      ? `Open chat, ${unread} unread`
      : "Open chat";

  return (
    <Button
      id={CHAT_TOGGLE_ID}
      type="button"
      size="icon"
      variant="ghost"
      aria-controls={CHAT_PANEL_ID}
      aria-expanded={open}
      aria-label={label}
      title={label}
      onClick={toggleChat}
      className={cn(
        "relative",
        className,
        open && "bg-primary text-primary-foreground hover:bg-primary",
      )}
    >
      <ChatIcon aria-hidden weight={open ? "fill" : "regular"} />
      {open || unread === 0 ? null : (
        <span
          aria-hidden="true"
          className="bg-error text-primary-foreground absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.625rem] leading-none font-bold"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Button>
  );
}
