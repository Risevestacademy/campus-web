import type { FeedbackPerson } from "./types/feedback.types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

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

export function describeAge(createdAt: string, now: number): string {
  const elapsed = Math.max(0, now - Date.parse(createdAt));

  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  return `${Math.floor(elapsed / DAY)} d ago`;
}
