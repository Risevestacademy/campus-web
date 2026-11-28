"use client";

import { PaperclipIcon } from "@phosphor-icons/react/dist/ssr/Paperclip";
import { PaperPlaneRightIcon } from "@phosphor-icons/react/dist/ssr/PaperPlaneRight";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from "react";

import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

import { useChatDraft } from "../../hooks/use-chat-panel";
import {
  CHAT_LINE_MAX_LENGTH,
  SEND_REFUSALS,
  useSendChat,
} from "../../hooks/use-send-chat";
import {
  NO_CALL_SPACE_MESSAGE,
  useSendChatFile,
} from "../../hooks/use-send-chat-file";
import { getChatDraft, setChatDraft } from "../../store/chat-panel-store";

// The counter shows only near the limit, where it matters.
const COUNTER_FROM = 400;

// What a file can be, for the picker: the browser offers these first, and the
// upload is checked against campus-api's own list all the same.
const FILE_PICKER_TYPES =
  "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

// Where the member writes. A line that cannot go out stays in the box with
// the reason beneath it, so nothing they typed is lost. A file goes with
// whatever is typed as its caption.
export function ChatComposer({
  cohortId,
  placeholder,
  synced,
}: Readonly<{ cohortId: string; placeholder: string; synced: boolean }>) {
  const draft = useChatDraft(cohortId);
  const { send } = useSendChat(cohortId);
  const file = useSendChatFile(cohortId);
  const picker = useRef<HTMLInputElement>(null);
  const [refusal, setRefusal] = useState<keyof typeof SEND_REFUSALS>();
  const [attachNotice, setAttachNotice] = useState<string>();
  // What world counts: the line once trimmed.
  const length = draft.trim().length;
  const tooLong = length > CHAT_LINE_MAX_LENGTH;
  const sending = file.activity.kind !== "idle";
  const canSend = synced && length > 0 && !tooLong && !sending;
  const reason =
    file.problem ??
    attachNotice ??
    (refusal
      ? SEND_REFUSALS[refusal]
      : synced
        ? ""
        : SEND_REFUSALS["not-ready"]);
  const isProblem = Boolean(file.problem ?? refusal);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;

    const outcome = send(draft);
    if (outcome === "sent") {
      setRefusal(undefined);
      setChatDraft(cohortId, "");
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

  function pickFile() {
    setAttachNotice(undefined);
    file.clearProblem();
    if (!file.canAttach) {
      setAttachNotice(NO_CALL_SPACE_MESSAGE);
      return;
    }
    picker.current?.click();
  }

  async function sendPickedFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked || tooLong) return;

    setRefusal(undefined);
    // What is typed now is the caption. The box is only cleared if it still
    // holds it: anything typed while the file uploaded is the member's to send.
    const caption = draft;
    if (
      (await file.sendFile(picked, caption)) &&
      getChatDraft(cohortId) === caption
    ) {
      setChatDraft(cohortId, "");
    }
  }

  return (
    <form onSubmit={submit} className="flex shrink-0 flex-col gap-1.5 p-3 pt-2">
      {file.activity.kind === "idle" ? null : (
        <div className="bg-surface-hover flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
          <p className="min-w-0 flex-1 truncate" role="status">
            {file.activity.kind === "uploading"
              ? `Uploading ${file.activity.fileName}`
              : `Sending ${file.activity.fileName}`}
          </p>
          {file.activity.kind === "uploading" ? (
            <div
              role="progressbar"
              aria-label="Uploading your file"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(file.activity.progress * 100)}
              className="bg-border h-1.5 w-16 shrink-0 overflow-hidden rounded-full"
            >
              <div
                className="bg-primary h-full transition-[width]"
                style={{ width: `${file.activity.progress * 100}%` }}
              />
            </div>
          ) : null}
          {/* Stays until the line is said: a file can still be stopped. */}
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={file.cancel}
            className="shrink-0"
          >
            Cancel upload
          </Button>
        </div>
      )}
      <div className="bg-surface border-shell-line focus-within:border-ring flex items-end gap-1 rounded-2xl border p-1.5">
        <input
          ref={picker}
          type="file"
          accept={FILE_PICKER_TYPES}
          aria-label="Choose a file to send"
          tabIndex={-1}
          onChange={(event) => void sendPickedFile(event)}
          className="sr-only"
        />
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Attach a file"
          title={file.canAttach ? "Attach a file" : NO_CALL_SPACE_MESSAGE}
          aria-disabled={!file.canAttach || sending || undefined}
          disabled={sending}
          onClick={pickFile}
          className="text-icon-muted shrink-0 aria-disabled:opacity-50"
        >
          <PaperclipIcon aria-hidden />
        </Button>
        <Textarea
          rows={1}
          value={draft}
          onChange={(event) => {
            setRefusal(undefined);
            setAttachNotice(undefined);
            file.clearProblem();
            setChatDraft(cohortId, event.target.value);
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
          className={isProblem ? "text-error-foreground" : undefined}
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
