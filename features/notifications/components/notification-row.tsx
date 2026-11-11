import type { Icon } from "@phosphor-icons/react";
import { BellIcon } from "@phosphor-icons/react/dist/ssr/Bell";
import { DoorOpenIcon } from "@phosphor-icons/react/dist/ssr/DoorOpen";
import { MegaphoneIcon } from "@phosphor-icons/react/dist/ssr/Megaphone";
import { ProhibitIcon } from "@phosphor-icons/react/dist/ssr/Prohibit";
import { cn } from "cn";

import type { NotificationKind } from "@/core/realtime";

import { relativeTime } from "../relative-time";

const KIND_ICONS: Record<NotificationKind, Icon> = {
  notice_posted: MegaphoneIcon,
  entry_request_admitted: DoorOpenIcon,
  entry_request_declined: ProhibitIcon,
  unknown: BellIcon,
};

interface NotificationRowProps {
  createdAt: string;
  isMarking: boolean;
  kind: NotificationKind;
  now: number;
  onRead: () => void;
  read: boolean;
  text: string;
}

// An unread notification is one button: reading it is pressing it, since there
// is nothing more to open yet. A read one is plain text.
export function NotificationRow({
  createdAt,
  isMarking,
  kind,
  now,
  onRead,
  read,
  text,
}: NotificationRowProps) {
  const KindIcon = KIND_ICONS[kind];
  const content = (
    <>
      <span
        aria-hidden
        className="bg-surface text-icon-muted grid size-9 shrink-0 place-items-center rounded-full"
      >
        <KindIcon size={18} weight="regular" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm text-pretty",
            read ? "text-foreground-secondary" : "text-foreground font-medium",
          )}
        >
          {text}
        </span>
        <span className="text-foreground-muted block text-xs">
          {relativeTime(createdAt, now)}
        </span>
      </span>
      {read ? null : (
        <span
          aria-hidden
          className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
        />
      )}
    </>
  );

  return (
    <li>
      {read ? (
        <div className="flex items-start gap-3 rounded-xl px-2 py-2.5">
          {content}
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Mark as read: ${text}`}
          disabled={isMarking}
          onClick={onRead}
          className="hover:bg-muted focus-visible:ring-ring/50 flex w-full cursor-pointer items-start gap-3 rounded-xl px-2 py-2.5 text-left outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {content}
        </button>
      )}
    </li>
  );
}
