import type { FeedbackPerson } from "./types/feedback.types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const AVATAR_TONES = [
  "bg-info-200 text-info-900",
  "bg-lemon-300 text-lemon-950",
  "bg-cobalt-300 text-cobalt-950",
  "bg-success-300 text-success-950",
  "bg-error-300 text-error-950",
] as const;

export function personName(person: FeedbackPerson): string {
  return person.displayName?.trim() || person.email;
}

export function reportedNameOf(item: {
  reportedUser: FeedbackPerson | null;
}): string | undefined {
  return item.reportedUser ? personName(item.reportedUser) : undefined;
}

export function personInitial(person: FeedbackPerson): string {
  return personName(person).charAt(0).toUpperCase();
}

export function initialOf(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function avatarTone(id: string): string {
  const sum = Array.from(id).reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );
  return AVATAR_TONES[sum % AVATAR_TONES.length] ?? AVATAR_TONES[0];
}

export function describeAge(createdAt: string, now: number): string {
  const elapsed = Math.max(0, now - Date.parse(createdAt));

  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  return `${Math.floor(elapsed / DAY)} d ago`;
}
