import type { ErrorMessage, ServerMessage } from "@/core/realtime";
import { toast } from "@/shared/ui/toast";

// World's `error` frame says why in a short developer sentence ("saying too
// much too fast"). It is not written for a member, so the sentences world is
// known to send read as copy here; one it adds later still shows, sentence
// cased, under a general title.
const WORLD_ERROR_TOAST_ID = "world-error";

interface Notice {
  title: string;
  description?: string;
}

const KNOWN_REFUSALS: readonly { says: RegExp; notice: Notice }[] = [
  // Chat
  {
    says: /^saying too much too fast/,
    notice: {
      title: "Slow down a little",
      description: "You can send five lines at once, then one a second.",
    },
  },
  // Not placed yet, or only watching
  {
    says: /^watching:/,
    notice: {
      title: "This tab is only watching",
      description: "Enter the campus here to move, chat and more.",
    },
  },
  {
    says: /^not on campus:/,
    notice: {
      title: "You're not on the campus yet",
      description: "Try again once you've joined.",
    },
  },
  // Locks
  {
    says: /^this space cannot be locked/,
    notice: { title: "This space can't be locked" },
  },
  // Walks
  {
    says: /^you cannot walk to yourself/,
    notice: { title: "You're already here" },
  },
  {
    says: /^that tile is off the map or in a wall/,
    notice: {
      title: "You can't go there",
      description: "Pick a place you can stand on.",
    },
  },
  {
    says: /^(no space with that key|walk to a tile in the corridors)/,
    notice: { title: "You can't walk there" },
  },
  // Asking to enter
  {
    says: /^no such space/,
    notice: { title: "That space isn't on this map" },
  },
  {
    says: /^you are inside it already/,
    notice: { title: "You're already inside" },
  },
  {
    says: /^you may walk in/,
    notice: {
      title: "No need to ask",
      description: "This space is open to you.",
    },
  },
  {
    says: /^this space takes no requests/,
    notice: { title: "This space doesn't take requests" },
  },
  {
    says: /^ask from beside the space/,
    notice: {
      title: "Get closer first",
      description: "Stand beside the space to ask to enter.",
    },
  },
  {
    says: /^nobody inside can answer/,
    notice: {
      title: "Nobody inside can answer",
      description: "Try again when someone is in there.",
    },
  },
  {
    says: /^you have a request open already/,
    notice: {
      title: "You're already asking",
      description: "Wait for an answer, or withdraw it first.",
    },
  },
  {
    says: /^asked again too soon after a no/,
    notice: {
      title: "Too soon to ask again",
      description: "You can ask again in about 30 seconds.",
    },
  },
  {
    says: /^no (open )?request/,
    notice: { title: "That request has already ended" },
  },
  // Staff
  {
    says: /^they are not here/,
    notice: { title: "They're not here any more" },
  },
  {
    says: /^you may not (mute|remove) them/,
    notice: { title: "You can't do that to them" },
  },
  {
    says: /^(they are in no call|they are not in the call)/,
    notice: { title: "They aren't in a call" },
  },
  {
    says: /^their microphone is not on/,
    notice: { title: "Their microphone is already off" },
  },
  {
    says: /^could not mute them/,
    notice: { title: "We couldn't mute them", description: "Try again." },
  },
  {
    says: /^(they are in no space|they cannot be removed from this space)/,
    notice: { title: "They can't be removed from here" },
  },
  {
    says: /^nowhere outside to move them/,
    notice: { title: "There's nowhere to move them to" },
  },
];

const BAD_MESSAGE_NOTICE: Notice = {
  title: "Something went wrong",
  description: "Try again. If it keeps happening, report an issue.",
};

function sentenceCase(text: string): string {
  const trimmed = text.trim().slice(0, 140);
  if (trimmed === "") return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}${/[.!?]$/.test(trimmed) ? "" : "."}`;
}

// What to show for one error frame, or null for one the member needs no
// toast for: an UNAUTHORIZED comes just before the socket closes, and the
// close policy already explains and acts on that.
export function worldErrorNotice({
  code,
  message,
}: ErrorMessage): Notice | null {
  if (code === "UNAUTHORIZED") return null;
  if (code === "BAD_MESSAGE") return BAD_MESSAGE_NOTICE;

  const known = KNOWN_REFUSALS.find(({ says }) => says.test(message.trim()));
  if (known) return known.notice;

  const description = sentenceCase(message);
  return {
    title: "That didn't work",
    ...(description && { description }),
  };
}

// One toast at a time: a burst of refusals (a held key, a double click)
// replaces itself instead of stacking.
export function announceWorldError(message: ServerMessage) {
  if (message.type !== "error") return;

  const notice = worldErrorNotice(message);
  if (!notice) return;

  toast.add({
    id: WORLD_ERROR_TOAST_ID,
    ...notice,
    priority: "high",
    type: "warning",
  });
}
