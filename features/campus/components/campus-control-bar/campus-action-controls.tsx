import { ChatIcon } from "@phosphor-icons/react/dist/ssr/Chat";
import { HandPalmIcon } from "@phosphor-icons/react/dist/ssr/HandPalm";
import { MonitorArrowUpIcon } from "@phosphor-icons/react/dist/ssr/MonitorArrowUp";

import { Button } from "@/shared/ui/button";

const campusActions = [
  { Icon: MonitorArrowUpIcon, label: "Share screen" },
  { Icon: ChatIcon, label: "Open chat" },
  { Icon: HandPalmIcon, label: "Raise hand" },
] as const;

export function CampusActionControls() {
  return (
    <div role="group" aria-label="Campus actions" className="flex gap-1.25">
      {campusActions.map(({ Icon, label }) => (
        <Button
          key={label}
          type="button"
          size="icon"
          variant="ghost"
          aria-label={label}
          title={label}
          className="bg-surface hover:ring-primary hover:ring-offset-background hover:ring hover:ring-offset-1 [&_svg:not([class*='size-'])]:size-5"
        >
          <Icon aria-hidden />
        </Button>
      ))}
    </div>
  );
}
