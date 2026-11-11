import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import Link from "next/link";

import { campusHref } from "@/core/navigation";
import { Separator } from "@/shared/ui/separator";

import { BackToCampusesControl } from "./back-to-campuses-control";
import type { CampusViewer } from "./campus-shell/feedback-layer";
import { MeetingMediaControls } from "./meeting-media-controls";
import { ScreenShareStatus } from "./screen-share-status";
import { StatusDock } from "./status-dock";

type PresenceDockProps = Readonly<{
  cohortId: string;
  viewer: CampusViewer;
}>;

export function PresenceDock({ cohortId, viewer }: PresenceDockProps) {
  return (
    <aside
      aria-label="Presence dock"
      className="bg-background fixed bottom-3 left-20 z-40 grid gap-1 rounded-[1.25rem] border p-1.5 shadow-lg"
    >
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
        <Separator orientation="vertical" className="mx-1 my-auto h-6" />
        <BackToCampusesControl />
      </StatusDock>
    </aside>
  );
}
