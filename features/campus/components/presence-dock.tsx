import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import Link from "next/link";

import { campusHref } from "@/core/navigation";
import { Separator } from "@/shared/ui/separator";

import { BackToCampusesControl } from "./back-to-campuses-control";
import { BroadcastControl } from "./broadcast-control";
import { BroadcastStatus } from "./broadcast-status";
import type { CampusViewer } from "./campus-shell/feedback-layer";
import { SIDEBAR_WIDTH } from "./campus-shell/sidebar-width";
import { MeetingMediaControls } from "./meeting-media-controls";
import { ScreenShareStatus } from "./screen-share-status";
import { StatusDock } from "./status-dock";

// Centred over the sidebar, which starts at left-19, as far in from its sides
// as bottom-3 is from the bottom.
const DOCK_INSET_PX = 12;

type PresenceDockProps = Readonly<{
  cohortId: string;
  viewer: CampusViewer;
}>;

export function PresenceDock({ cohortId, viewer }: PresenceDockProps) {
  return (
    <aside
      aria-label="Presence dock"
      style={{ width: SIDEBAR_WIDTH - 2 * DOCK_INSET_PX }}
      className="bg-background fixed bottom-3 left-22 z-40 grid gap-1 rounded-[1.25rem] border p-1.5 shadow-lg"
    >
      <BroadcastStatus cohortId={cohortId} />
      <ScreenShareStatus cohortId={cohortId} />
      <Link
        href={campusHref(cohortId)}
        className="text-foreground-secondary hover:text-foreground flex w-fit items-center gap-1 px-1.5 text-xs"
      >
        <MapPinIcon aria-hidden className="size-3.5" />
        Campus map
      </Link>

      <StatusDock
        cohortId={cohortId}
        rowClassName="flex items-center justify-center gap-1.5"
        stackedTray
        viewer={viewer}
      >
        <Separator orientation="vertical" className="mx-1 my-auto h-6" />
        <MeetingMediaControls className="gap-1.5" cohortId={cohortId} />
        <BroadcastControl className="bg-surface" cohortId={cohortId} />
        <Separator orientation="vertical" className="mx-1 my-auto h-6" />
        <BackToCampusesControl />
      </StatusDock>
    </aside>
  );
}
