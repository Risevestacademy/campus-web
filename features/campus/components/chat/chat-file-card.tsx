"use client";

import type { ChatAttachment } from "@/core/realtime";
import { Button } from "@/shared/ui/button";

import { useGoneFileIds } from "../../hooks/use-chat-panel";
import { useOpenChatFile } from "../../hooks/use-open-chat-file";
import {
  fileKindOf,
  fileNameOf,
  formatFileSize,
} from "../../services/chat/chat-files";
import { ChatFileIcon } from "./chat-file-icon";

export const FILE_GONE_NOTICE =
  "This file is no longer available. Files close when the call ends.";

// A file sent in chat: what it is, how big, and a way to open it. Opening asks
// for a fresh link; once the call has ended the file is let go and the card says
// so.
export function ChatFileCard({
  attachment,
  detail,
}: Readonly<{
  attachment: ChatAttachment;
  // A line under the size, such as who sent it.
  detail?: string;
}>) {
  const gone = useGoneFileIds().includes(attachment.mediaId);
  const { open, opening } = useOpenChatFile();
  const name = fileNameOf(attachment);

  return (
    <div className="border-shell-line flex items-center gap-2.5 rounded-xl border p-2">
      <ChatFileIcon kind={fileKindOf(attachment)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={name}>
          {name}
        </p>
        <p className="text-foreground-secondary truncate text-xs">
          {gone
            ? FILE_GONE_NOTICE
            : [formatFileSize(attachment.sizeBytes), detail]
                .filter(Boolean)
                .join(" · ")}
        </p>
      </div>
      {gone ? null : (
        <Button
          type="button"
          size="xs"
          variant="outline"
          aria-label={`Open ${name}`}
          disabled={opening !== null}
          onClick={() => void open(attachment)}
          className="shrink-0"
        >
          {opening === attachment.mediaId ? "Opening…" : "Open"}
        </Button>
      )}
    </div>
  );
}
