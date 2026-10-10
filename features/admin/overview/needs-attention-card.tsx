import type { Icon } from "@phosphor-icons/react";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise";
import { ChecksIcon } from "@phosphor-icons/react/dist/ssr/Checks";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { cn } from "cn";

import { Button } from "@/shared/ui/button";

import type { AttentionItem, AttentionKind } from "./overview-data";

const KIND_STYLES: Readonly<
  Record<AttentionKind, { Icon: Icon; tileClassName: string }>
> = {
  report: {
    Icon: WarningCircleIcon,
    tileClassName: "bg-error-100 text-error-600 dark:bg-error-900/40",
  },
  attendance: {
    Icon: ChecksIcon,
    tileClassName: "bg-lemon-100 text-lemon-700 dark:bg-lemon-900/40",
  },
  sync: {
    Icon: ArrowsClockwiseIcon,
    tileClassName: "bg-cobalt-100 text-cobalt-600 dark:bg-cobalt-900/60",
  },
};

export function NeedsAttentionCard({
  items,
}: {
  items: readonly AttentionItem[];
}) {
  return (
    <section
      aria-labelledby="needs-attention-heading"
      className="border-border grid content-start gap-5 rounded-2xl border p-6 dark:border-[#2B3B5F]"
    >
      <header className="flex items-baseline justify-between gap-4">
        <h2
          id="needs-attention-heading"
          className="font-display text-xl font-semibold"
        >
          Needs attention
        </h2>
        <p className="text-error-700 dark:text-error-300 text-sm">
          {items.length} new
        </p>
      </header>

      <ul className="grid gap-3">
        {items.map((item) => {
          const { Icon: ItemIcon, tileClassName } = KIND_STYLES[item.kind];

          return (
            <li
              key={item.id}
              className="flex items-center gap-4 rounded-xl bg-[#EFFAFF] p-3 dark:bg-[#2B3B5F]"
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl",
                  tileClassName,
                )}
              >
                <ItemIcon aria-hidden size={20} />
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate text-sm font-medium">
                  {item.title}
                </span>
                <span className="text-foreground-secondary truncate text-sm">
                  {item.detail}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                {item.actionLabel}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
