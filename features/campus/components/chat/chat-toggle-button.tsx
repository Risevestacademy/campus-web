"use client";

import { ChatIcon } from "@phosphor-icons/react/dist/ssr/Chat";
import { cn } from "cn";

import { Button } from "@/shared/ui/button";

import { useChatOpen } from "../../hooks/use-chat-panel";
import { toggleChat } from "../../store/chat-panel-store";
import { CHAT_PANEL_ID, CHAT_TOGGLE_ID } from "./chat-ids";

// Opens the chat panel, and closes it again. While it is open the sidebar
// gives way, so the meeting keeps its room.
export function ChatToggleButton({
  className,
}: Readonly<{ className?: string }>) {
  const open = useChatOpen();
  const label = open ? "Close chat" : "Open chat";

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
        className,
        open && "bg-primary text-primary-foreground hover:bg-primary",
      )}
    >
      <ChatIcon aria-hidden weight={open ? "fill" : "regular"} />
    </Button>
  );
}
