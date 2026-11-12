import { contains, type Space, type Tile } from "campus-world-map";

import { type Presence, refusedEntryNotice } from "@/core/presence";
import { toast } from "@/shared/ui/toast";

const REFUSED_STEP_TOAST_ID = "refused-step";

export function spaceAt(spaces: readonly Space[], tile: Tile): string | null {
  return spaces.find(({ bounds }) => contains(bounds, tile))?.key ?? null;
}

// World refuses a step into a locked space, or a listed one the member is not
// on; held against it, each key press is refused again, so one toast is kept.
export function announceRefusedStep(
  spaces: readonly Space[],
  presence: Presence,
  tile: Tile,
) {
  toast.add({
    id: REFUSED_STEP_TOAST_ID,
    priority: "high",
    title: refusedEntryNotice(presence, spaceAt(spaces, tile)),
    type: "warning",
  });
}
