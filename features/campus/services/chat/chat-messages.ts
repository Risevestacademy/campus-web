import {
  chatInOwnSpace,
  type ChatLine,
  type Participant,
  type Presence,
} from "@/core/presence";
import { avatarToneOf, initialOf } from "@/shared/lib/avatar";

import { OWN_NAME } from "../own-name";

const UNNAMED_SPEAKER = "Campus member";

type ChatPresence = Pick<Presence, "chat" | "selfId" | "participants">;

// A line as the panel draws it.
export type ChatMessage = Readonly<{
  id: string;
  userId: string;
  name: string;
  initial: string;
  avatarClassName: string;
  text: string;
  at: string;
  isOwn: boolean;
}>;

// Lines from one person in the same minute, drawn under one header.
export type ChatGroup = Readonly<{
  key: string;
  first: ChatMessage;
  messages: readonly ChatMessage[];
}>;

// World only sends what is said in the member's own space, and the presence
// store drops a space's lines when they leave it. This keeps a line out of
// the panel all the same if a frame puts the member somewhere else first.
export function selectChatLines(presence: ChatPresence): readonly ChatLine[] {
  return chatInOwnSpace(presence);
}

function nameOf(
  line: ChatLine,
  participants: ReadonlyMap<string, Participant>,
): string {
  return (
    line.senderName?.trim() ||
    participants.get(line.userId)?.displayName?.trim() ||
    UNNAMED_SPEAKER
  );
}

export function messageOf(
  line: ChatLine,
  { selfId, participants }: Pick<ChatPresence, "selfId" | "participants">,
): ChatMessage {
  const isOwn = line.userId === selfId;
  const name = isOwn ? OWN_NAME : nameOf(line, participants);
  return {
    id: line.id,
    userId: line.userId,
    name,
    initial: initialOf(isOwn ? nameOf(line, participants) : name),
    avatarClassName: avatarToneOf(line.userId),
    text: line.text,
    at: line.at,
    isOwn,
  };
}

export function selectChatMessages(
  presence: ChatPresence,
): readonly ChatMessage[] {
  return selectChatLines(presence).map((line) => messageOf(line, presence));
}

function minuteOf(at: string): number {
  return Math.floor(Date.parse(at) / 60_000);
}

export function groupMessages(
  messages: readonly ChatMessage[],
): readonly ChatGroup[] {
  const groups: { first: ChatMessage; messages: ChatMessage[] }[] = [];
  let previous: ChatMessage | undefined;

  for (const message of messages) {
    const current = groups.at(-1);
    const continues =
      previous !== undefined &&
      current !== undefined &&
      previous.userId === message.userId &&
      minuteOf(previous.at) === minuteOf(message.at);
    if (continues) current.messages.push(message);
    else groups.push({ first: message, messages: [message] });
    previous = message;
  }

  return groups.map((group) => ({ key: group.first.id, ...group }));
}

const TIME = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

// The time of day on this device, or nothing for a time that does not parse.
export function formatChatTime(at: string | number): string {
  const time = typeof at === "number" ? at : Date.parse(at);
  return Number.isNaN(time) ? "" : TIME.format(time);
}

// Lines from other people after the newest one the member has seen. A marker
// that is no longer in the list, because its space was left or it aged out,
// leaves every line from somebody else unread.
export function unreadCount(
  lines: readonly Pick<ChatLine, "id" | "userId">[],
  selfId: string | null,
  readThroughId: string | null,
): number {
  const seen =
    readThroughId === null
      ? -1
      : lines.findIndex(({ id }) => id === readThroughId);
  return lines.slice(seen + 1).filter(({ userId }) => userId !== selfId).length;
}
