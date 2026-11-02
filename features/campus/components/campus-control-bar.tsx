import { ChatIcon } from "@phosphor-icons/react/dist/ssr/Chat";
import { HandPalmIcon } from "@phosphor-icons/react/dist/ssr/HandPalm";
import type { ReactNode } from "react";

import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";

import type { PresenceStatus } from "../types/active-campus.types";
import { BackToCampusesControl } from "./back-to-campuses-control";
import { MediaControls } from "./media-controls";
import { PresenceMenuTrigger } from "./presence-menu-trigger";
import { ScreenShareControl } from "./screen-share-control";

const campusActions = [
  { Icon: ChatIcon, label: "Open chat" },
  { Icon: HandPalmIcon, label: "Raise hand" },
] as const;

const CAMPUS_ACTION_CLASS_NAME =
  "bg-surface hover:ring-primary hover:ring-offset-background hover:ring hover:ring-offset-1 [&_svg:not([class*='size-'])]:size-5";

type CampusControlBarProps = Readonly<{
  cohortId: string;
  initials: string;
  status: PresenceStatus;
  zoomControls: ReactNode;
}>;

function CampusActionControls({ cohortId }: Readonly<{ cohortId: string }>) {
  return (
    <div role="group" aria-label="Campus actions" className="flex gap-1.25">
      <ScreenShareControl
        className={CAMPUS_ACTION_CLASS_NAME}
        cohortId={cohortId}
      />
      {campusActions.map(({ Icon, label }) => (
        <Button
          key={label}
          type="button"
          size="icon"
          variant="ghost"
          aria-label={label}
          title={label}
          className={CAMPUS_ACTION_CLASS_NAME}
        >
          <Icon aria-hidden />
        </Button>
      ))}
    </div>
  );
}

export function CampusControlBar({
  cohortId,
  initials,
  status,
  zoomControls,
}: CampusControlBarProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end">
      <div className="bg-background col-start-2 flex items-center gap-1.5 rounded-l-[1.25rem] rounded-r-[1.125rem] py-1.5 pr-1.75 pl-2">
        <PresenceMenuTrigger initials={initials} status={status} />
        <Separator orientation="vertical" className="mx-1.5 my-auto h-6" />
        <MediaControls className="gap-1.5" />
        <CampusActionControls cohortId={cohortId} />
        <Separator orientation="vertical" className="mx-1.5 my-auto h-6" />
        <BackToCampusesControl />
      </div>

      <div className="ml-auto">{zoomControls}</div>
    </div>
  );
}
