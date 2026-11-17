"use client";

import { PaperclipIcon } from "@phosphor-icons/react/dist/ssr/Paperclip";
import { PaperPlaneRightIcon } from "@phosphor-icons/react/dist/ssr/PaperPlaneRight";
import { type FormEvent, type KeyboardEvent, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

import { useChatDraft } from "../../hooks/use-chat-panel";
import { CHAT_LINE_MAX_LENGTH, useSendChat } from "../../hooks/use-send-chat";
import { setChatDraft } from "../../store/chat-panel-store";

// The counter shows only near the limit, where it matters.
const COUNTER_FROM = 400;

const REFUSALS = {
  "not-ready": "Reconnecting…",
  "too-fast": "You're sending too fast. Try again in a moment.",
} as const;

// Where the member writes. A line that cannot go out stays in the box with
// the reason beneath it, so nothing they typed is lost.
export function ChatComposer({
  cohortId,
  placeholder,
  synced,
}: Readonly<{ cohortId: string; placeholder: string; synced: boolean }>) {
  const draft = useChatDraft();
  const { send } = useSendChat(cohortId);
  const [refusal, setRefusal] = useState<keyof typeof REFUSALS>();
  const length = draft.length;
  const tooLong = draft.trim().length > CHAT_LINE_MAX_LENGTH;
  const canSend = synced && draft.trim().length > 0 && !tooLong;
  const reason = refusal
    ? REFUSALS[refusal]
    : synced
      ? ""
      : REFUSALS["not-ready"];

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;

    const outcome = send(draft);
    if (outcome === "sent") {
      setRefusal(undefined);
      setChatDraft("");
    } else if (outcome === "too-fast" || outcome === "not-ready") {
      setRefusal(outcome);
    }
  }

  function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;

    event.preventDefault();
    submit();
  }

  return (
    <form onSubmit={submit} className="flex shrink-0 flex-col gap-1.5 p-3 pt-2">
      <div className="bg-surface border-shell-line focus-within:border-ring flex items-end gap-1 rounded-2xl border p-1.5">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Attach a file"
          title="File sharing is coming soon"
          aria-disabled="true"
          className="text-icon-muted shrink-0 aria-disabled:opacity-50"
        >
          <PaperclipIcon aria-hidden />
        </Button>
        <Textarea
          rows={1}
          value={draft}
          onChange={(event) => {
            setRefusal(undefined);
            setChatDraft(event.target.value);
          }}
          onKeyDown={submitOnEnter}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={tooLong || undefined}
          className="max-h-24 min-h-8 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm focus-visible:ring-0 dark:bg-transparent"
        />
        <Button
          type="submit"
          size="icon-xs"
          aria-label="Send message"
          disabled={!canSend}
          className="shrink-0"
        >
          <PaperPlaneRightIcon aria-hidden />
        </Button>
      </div>
      <div className="text-foreground-secondary flex min-h-4 justify-between gap-2 text-xs">
        <p
          role="status"
          className={refusal ? "text-error-foreground" : undefined}
        >
          {reason}
        </p>
        {length >= COUNTER_FROM ? (
          <p
            className={tooLong ? "text-error-foreground" : undefined}
            aria-live="off"
          >
            {length}/{CHAT_LINE_MAX_LENGTH}
          </p>
        ) : null}
      </div>
    </form>
  );
}
