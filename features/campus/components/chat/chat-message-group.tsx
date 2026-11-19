import { cn } from "cn";

import { Avatar, AvatarFallback } from "@/shared/ui/avatar";

import {
  type ChatGroup,
  formatChatTime,
} from "../../services/chat/chat-messages";
import { ChatFileCard } from "./chat-file-card";

// One person's lines from the same minute: their avatar, name and time once,
// then each line. Text is only ever drawn as text.
export function ChatMessageGroup({ group }: Readonly<{ group: ChatGroup }>) {
  const { first, messages } = group;

  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2.5">
      <Avatar>
        <AvatarFallback
          className={cn("text-sm font-medium", first.avatarClassName)}
        >
          {first.initial}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold">{first.name}</span>
          <time
            dateTime={first.at}
            className="text-foreground-secondary shrink-0 text-xs"
          >
            {formatChatTime(first.at)}
          </time>
        </p>
        {messages.map((message) => (
          <div key={message.id} className="flex flex-col gap-1">
            {message.text ? (
              <p className="text-sm [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                {message.text}
              </p>
            ) : null}
            {message.attachment ? (
              <ChatFileCard attachment={message.attachment} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
