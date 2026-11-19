import { useState } from "react";

import { browserApi } from "@/core/api/client/browser";
import { SIGN_IN_PATH } from "@/core/navigation";
import type { ChatAttachment } from "@/core/realtime";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { toast } from "@/shared/ui/toast";

import { readFileLink } from "../services/chat/chat-attachment-api.adapter";
import { markFileGone } from "../store/chat-panel-store";

const FILE_TOAST_ID = "chat-file";

// Opens a file sent in a call's chat. A link lasts fifteen minutes, so one is
// asked for each time and never kept. A tab is opened first, in the click, so
// a browser does not take the wait for a link as a popup; it is given the link
// once there is one. A file that answers 410 is let go: the call ended.
export function useOpenChatFile() {
  const [opening, setOpening] = useState<string | null>(null);

  async function open({ mediaId }: ChatAttachment): Promise<void> {
    if (opening !== null) return;

    setOpening(mediaId);
    const tab = window.open("", "_blank");
    try {
      const result = await readFileLink(browserApi, mediaId);
      if (result.kind === "link") {
        if (tab) {
          tab.opener = null;
          tab.location.href = result.url;
        } else {
          window.open(result.url, "_blank", "noopener,noreferrer");
        }
        return;
      }

      tab?.close();
      if (result.problem === "gone") markFileGone(mediaId);
      else if (result.problem === "signed-out") replaceDocument(SIGN_IN_PATH);
      else {
        toast.add({
          id: FILE_TOAST_ID,
          priority: "high",
          title: "We couldn't open that file",
          description: "Check your connection and try again.",
          type: "warning",
        });
      }
    } finally {
      setOpening(null);
    }
  }

  return { open, opening };
}
