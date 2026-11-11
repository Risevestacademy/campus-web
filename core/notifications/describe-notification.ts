import type { NotificationKind } from "@/core/realtime";

export interface NotificationSubject {
  kind: NotificationKind;
  context: { cohortId: string; spaceKey: string } | null;
}

// What a notification says, in the member's words, for the toast that greets a
// new one and the list that keeps it. `spaceName` turns the space an entry
// request was for into what to call it. A kind world adds later reads as a
// plain alert rather than being dropped.
export function describeNotification(
  { kind, context }: NotificationSubject,
  spaceName: (context: NonNullable<NotificationSubject["context"]>) => string,
): string {
  switch (kind) {
    case "notice_posted":
      return "A new notice was posted.";
    case "entry_request_admitted":
      return context
        ? `You were let into ${spaceName(context)}.`
        : "Your request to enter a space was admitted.";
    case "entry_request_declined":
      return context
        ? `Your request to enter ${spaceName(context)} was declined.`
        : "Your request to enter a space was declined.";
    default:
      return "You have a new notification.";
  }
}
