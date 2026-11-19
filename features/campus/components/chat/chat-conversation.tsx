"use client";

import { useChatMessages } from "../../hooks/use-chat-messages";
import { useMarkChatRead } from "../../hooks/use-chat-unread";
import { ChatComposer } from "./chat-composer";
import { ChatMessageList } from "./chat-message-list";

// What is said in the member's space. It is only mounted while it shows, so
// whatever arrives here is read.
export function ChatConversation({
  cohortId,
  spaceName,
}: Readonly<{ cohortId: string; spaceName: string | null }>) {
  const { enteredAt, messages, synced } = useChatMessages(cohortId);
  useMarkChatRead(cohortId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="bg-surface-hover text-foreground-secondary mx-3 mt-3 rounded-xl px-3 py-1.5 text-xs">
        Messages aren&apos;t saved. People who join later won&apos;t see these.
      </p>
      <ChatMessageList enteredAt={enteredAt} messages={messages} />
      <ChatComposer
        cohortId={cohortId}
        placeholder={`Message ${spaceName ?? "people nearby"}`}
        synced={synced}
      />
    </div>
  );
}
