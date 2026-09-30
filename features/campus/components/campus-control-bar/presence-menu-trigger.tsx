import { Avatar, AvatarBadge, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";

export type PresenceStatus = "active" | "busy" | "away";

const presenceStatusConfig = {
  active: {
    badgeClassName: "bg-success",
    label: "Active",
  },
  busy: {
    badgeClassName: "bg-warning",
    label: "Busy",
  },
  away: {
    badgeClassName: "border-warning-icon border-2 bg-transparent",
    label: "Away",
  },
} satisfies Record<PresenceStatus, { badgeClassName: string; label: string }>;

type PresenceMenuTriggerProps = Readonly<{
  initials: string;
  status: PresenceStatus;
}>;

export function PresenceMenuTrigger({
  initials,
  status,
}: PresenceMenuTriggerProps) {
  const statusConfig = presenceStatusConfig[status];

  return (
    <Button
      type="button"
      size="icon-sm"
      aria-label={`Open presence settings. Current status: ${statusConfig.label}`}
      title={`Presence: ${statusConfig.label}`}
      className="bg-primary hover:bg-primary/80 p-0"
    >
      <Avatar size="lg" className="dark:after:border-transparent">
        <AvatarFallback className="bg-primary text-primary-foreground">
          {initials}
        </AvatarFallback>
        <AvatarBadge className={statusConfig.badgeClassName}>
          <span className="sr-only">{statusConfig.label}</span>
        </AvatarBadge>
      </Avatar>
    </Button>
  );
}
