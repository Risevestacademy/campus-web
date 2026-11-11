import { ChatIcon } from "@phosphor-icons/react/dist/ssr/Chat";
import { HandPalmIcon } from "@phosphor-icons/react/dist/ssr/HandPalm";
import type { ReactNode } from "react";

import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";

import { BackToCampusesControl } from "./back-to-campuses-control";
import type { CampusViewer } from "./campus-shell/feedback-layer";
import { MeetingMediaControls } from "./meeting-media-controls";
import { ScreenShareControl } from "./screen-share-control";
import { StatusDock } from "./status-dock";

const campusActions = [
  { Icon: ChatIcon, label: "Open chat" },
  { Icon: HandPalmIcon, label: "Raise hand" },
] as const;

const CAMPUS_ACTION_CLASS_NAME =
  "bg-surface hover:ring-primary hover:ring-offset-background hover:ring hover:ring-offset-1 [&_svg:not([class*='size-'])]:size-5";

type CampusControlBarProps = Readonly<{
  cohortId: string;
  viewer: CampusViewer;
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
  viewer,
  zoomControls,
}: CampusControlBarProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end">
      <StatusDock
        className="bg-background col-start-2 rounded-l-[1.25rem] rounded-r-[1.125rem]"
        cohortId={cohortId}
        rowClassName="flex items-center justify-center gap-1.5 py-1.5 pr-1.75 pl-2"
        viewer={viewer}
      >
        <Separator orientation="vertical" className="mx-1.5 my-auto h-6" />
        <MeetingMediaControls className="gap-1.5" cohortId={cohortId} />
        <CampusActionControls cohortId={cohortId} />
        <Separator orientation="vertical" className="mx-1.5 my-auto h-6" />
        <BackToCampusesControl />
      </StatusDock>

      <div className="ml-auto">{zoomControls}</div>
    </div>
  );
}
