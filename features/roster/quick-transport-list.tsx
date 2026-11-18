import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";

import type { QuickTransportDestination } from "./quick-transport";

export function QuickTransportList({
  destinations,
  onSelect,
}: {
  destinations: readonly QuickTransportDestination[];
  onSelect?: (destination: QuickTransportDestination) => void;
}) {
  return (
    <div>
      <p className="text-foreground-muted px-2 text-xs font-semibold tracking-wider uppercase">
        Quick transport
      </p>
      <ul className="mt-2 space-y-0.5">
        {destinations.map((destination) => (
          <li key={destination.id}>
            <button
              type="button"
              aria-label={`Go to ${destination.label}`}
              onClick={() => onSelect?.(destination)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-left hover:bg-[#EFFAFF] dark:hover:bg-[#2B3B5F]"
            >
              <span
                aria-hidden
                className="bg-info-500 size-2 shrink-0 rounded-full"
              />
              <span className="text-foreground flex-1 truncate text-sm font-medium">
                {destination.label}
              </span>
              <ArrowRightIcon
                aria-hidden
                size={14}
                className="text-icon-muted"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
