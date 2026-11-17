"use client";

import { useChatFiles } from "../../hooks/use-chat-files";
import { formatChatTime } from "../../services/chat/chat-messages";
import { ChatFileCard } from "./chat-file-card";

// The files sent in the space, newest first, each with who sent it and when.
// World keeps nothing and files close with the call, so this is what this
// device has seen since the member came into the space.
export function ResourcesTab({ cohortId }: Readonly<{ cohortId: string }>) {
  const files = useChatFiles(cohortId);

  if (files.length === 0) {
    return (
      <p className="text-foreground-secondary grid flex-1 place-items-center p-6 text-center text-sm">
        No files yet. Files sent in this meeting show up here.
      </p>
    );
  }

  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
      {files.map(({ at, attachment, id, senderName }) => (
        <li key={id}>
          <ChatFileCard
            attachment={attachment}
            detail={`${senderName} · ${formatChatTime(at)}`}
          />
        </li>
      ))}
    </ul>
  );
}
