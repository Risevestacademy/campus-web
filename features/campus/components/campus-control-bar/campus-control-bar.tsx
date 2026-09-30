import { Separator } from "@/shared/ui/separator";

import { MediaControls } from "../media-controls";
import { BackToCampusesControl } from "./back-to-campuses-control";
import { CampusActionControls } from "./campus-action-controls";
import {
  PresenceMenuTrigger,
  type PresenceStatus,
} from "./presence-menu-trigger";
import { ZoomControls } from "./zoom-controls";

type CampusControlBarProps = Readonly<{
  initials: string;
  status: PresenceStatus;
}>;

export function CampusControlBar({ initials, status }: CampusControlBarProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end">
      <div className="bg-background col-start-2 flex items-center gap-1.5 rounded-l-[1.25rem] rounded-r-[1.125rem] py-1.5 pr-1.75 pl-2">
        <PresenceMenuTrigger initials={initials} status={status} />
        <Separator orientation="vertical" className="mx-1.5 my-auto h-6" />
        <MediaControls className="gap-1.5" />
        <CampusActionControls />
        <Separator orientation="vertical" className="mx-1.5 my-auto h-6" />
        <BackToCampusesControl />
      </div>

      <ZoomControls />
    </div>
  );
}
