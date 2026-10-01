import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { cn } from "cn";

import { quickTransportDestinations } from "./quick-transport";

export function QuickTransportList() {
  return (
    <div>
      <p className="text-foreground-muted px-2 text-xs font-semibold tracking-wider uppercase">
        Quick transport
      </p>
      <ul className="mt-2 space-y-0.5">
        {quickTransportDestinations.map((destination) => (
          <li key={destination.id}>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-left hover:bg-[#EFFAFF] dark:hover:bg-[#2B3B5F]",
                destination.isLiveNow && "bg-[#EFFAFF] dark:bg-[#2B3B5F]",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  destination.dotClassName,
                )}
              />
              <span className="text-foreground flex-1 truncate text-sm font-medium">
                {destination.label}
              </span>
              {destination.isLiveNow ? (
                <span className="text-error text-xs font-medium">Live now</span>
              ) : (
                <ArrowRightIcon
                  aria-hidden
                  size={14}
                  className="text-icon-muted"
                />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
