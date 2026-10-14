import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import Link from "next/link";

import { campusHref } from "@/core/navigation";
import { Separator } from "@/shared/ui/separator";

import { BackToCampusesControl } from "./back-to-campuses-control";
import { MediaControls } from "./media-controls";
import { PresenceMenuTrigger } from "./presence-menu-trigger";

type PresenceDockProps = Readonly<{
  cohortId: string;
  userName?: string | null;
}>;

const UNKNOWN_INITIALS = "?";

function initialsOf(userName: string | null | undefined): string {
  const initials = (userName ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return initials || UNKNOWN_INITIALS;
}

export function PresenceDock({ cohortId, userName }: PresenceDockProps) {
  return (
    <aside
      aria-label="Presence dock"
      className="bg-background fixed bottom-3 left-20 z-40 grid gap-1 rounded-[1.25rem] border p-1.5 shadow-lg"
    >
      <Link
        href={campusHref(cohortId)}
        className="text-foreground-secondary hover:text-foreground flex w-fit items-center gap-1 px-1.5 text-xs"
      >
        <MapPinIcon aria-hidden className="size-3.5" />
        Campus map
      </Link>

      <div className="flex items-center gap-1.5">
        <PresenceMenuTrigger initials={initialsOf(userName)} status="active" />
        <Separator orientation="vertical" className="mx-1 my-auto h-6" />
        <MediaControls className="gap-1.5" />
        <Separator orientation="vertical" className="mx-1 my-auto h-6" />
        <BackToCampusesControl />
      </div>
    </aside>
  );
}
