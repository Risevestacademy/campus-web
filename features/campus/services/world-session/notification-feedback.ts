import { describeNotification } from "@/core/notifications";
import { type Presence, spaceNameOf } from "@/core/presence";
import type { NotificationMessage, ServerMessage } from "@/core/realtime";
import { toast } from "@/shared/ui/toast";

const TOAST_TYPES = {
  entry_request_admitted: "success",
  entry_request_declined: "warning",
} as const;

export function notificationNotice(
  message: NotificationMessage,
  presence: Pick<Presence, "spaceNames">,
) {
  return {
    title: describeNotification(message, ({ spaceKey }) =>
      spaceNameOf(presence, spaceKey),
    ),
    type:
      message.kind === "entry_request_admitted" ||
      message.kind === "entry_request_declined"
        ? TOAST_TYPES[message.kind]
        : ("info" as const),
  };
}

// A nudge, not the record: the list in campus-api is that. A campus-wide one
// reaches every socket the member has open, so the toast is keyed by the
// notification's id and a repeat replaces itself.
export function announceNotification(
  message: ServerMessage,
  presence: Presence,
) {
  if (message.type !== "notification") return;

  toast.add({
    id: `notification:${message.id}`,
    ...notificationNotice(message, presence),
  });
}
