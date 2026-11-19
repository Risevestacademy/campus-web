import type { ChatAttachment } from "@/core/realtime";

import type { ChatMessage } from "./chat-messages";

export type FileKind =
  "image" | "pdf" | "document" | "spreadsheet" | "presentation" | "file";

const FILE_KINDS: ReadonlyMap<string, FileKind> = new Map([
  ["image/jpeg", "image"],
  ["image/png", "image"],
  ["image/webp", "image"],
  ["image/gif", "image"],
  ["application/pdf", "pdf"],
  ["application/msword", "document"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "document",
  ],
  ["application/vnd.ms-excel", "spreadsheet"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "spreadsheet",
  ],
  ["application/vnd.ms-powerpoint", "presentation"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "presentation",
  ],
]);

// What a file is, from the type its sender gave it, for the icon beside it. A
// type outside the known ones is a plain file: nothing is guessed from it.
export function fileKindOf({ contentType }: ChatAttachment): FileKind {
  return FILE_KINDS.get(contentType.toLowerCase()) ?? "file";
}

const UNNAMED_FILE = "File";

// The name the sender gave it, or a plain name when they gave none.
export function fileNameOf({ fileName }: ChatAttachment): string {
  return fileName?.trim() || UNNAMED_FILE;
}

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes < KILOBYTE) return `${bytes} B`;
  if (bytes < MEGABYTE) return `${Math.round(bytes / KILOBYTE)} KB`;
  return `${(bytes / MEGABYTE).toFixed(1)} MB`;
}

// A file seen in the space: the line it came on, who sent it and when.
export type ChatFile = Readonly<{
  id: string;
  attachment: ChatAttachment;
  senderName: string;
  at: string;
}>;

// The files sent in the space, newest first.
export function selectChatFiles(
  messages: readonly ChatMessage[],
): readonly ChatFile[] {
  return messages
    .flatMap(({ attachment, at, id, name }) =>
      attachment ? [{ id, attachment, senderName: name, at }] : [],
    )
    .reverse();
}
