import { Avatar, AvatarFallback } from "@/shared/ui/avatar";

const CURRENT_USER_INITIAL = "J";

export function RailAvatar() {
  return (
    <Avatar size="lg">
      <AvatarFallback className="bg-accent text-accent-foreground font-medium">
        {CURRENT_USER_INITIAL}
      </AvatarFallback>
    </Avatar>
  );
}
