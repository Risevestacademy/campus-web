import { cn } from "cn";

import { GROUP_COLORS } from "./space-colors";
import {
  KIND_GROUP_ORDER,
  KIND_GROUPS,
  KIND_LABELS,
  SPACE_KINDS,
} from "./space-labels";

// Each colour is named by the kinds it stands for, so the legend never drifts
// from the grouping.
function kindsIn(group: string): string {
  return SPACE_KINDS.filter((kind) => KIND_GROUPS[kind] === group)
    .map((kind) => KIND_LABELS[kind])
    .join(", ");
}

const swatch = "size-3 shrink-0 rounded-sm border-2";

export function MapLegend() {
  return (
    <ul
      aria-label="Legend"
      className="text-foreground-secondary flex flex-wrap gap-x-4 gap-y-2 text-xs"
    >
      {KIND_GROUP_ORDER.map((group) => (
        <li key={group} className="flex items-center gap-1.5">
          <span className={cn(swatch, GROUP_COLORS[group].swatch)} />
          {kindsIn(group)}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span
          className={cn(
            swatch,
            "border-warning bg-[repeating-linear-gradient(45deg,var(--color-warning)_0_2px,transparent_2px_5px)] opacity-80",
          )}
        />
        Needs a kind, admins only
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn(swatch, "border-dashed border-neutral-500")} />
        Not in the campus until you sync
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn(swatch, "border-success-700")} />
        Added by this sync
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn(swatch, "border-cobalt-700")} />
        Restored by this sync
      </li>
      <li className="flex items-center gap-1.5">
        <span className="bg-cobalt-700/60 size-2.5 rounded-[3px]" />
        Desk
      </li>
    </ul>
  );
}
