import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";

import { Button } from "@/shared/ui/button";

import { feedbackKindDetails } from "./feedback-kinds";
import type { FeedbackItem } from "./types";

export function FeedbackList({
  items,
  activeId,
  onSelect,
  onNew,
}: {
  items: readonly FeedbackItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <section
      aria-labelledby="feedback-history-heading"
      className="grid content-start gap-4"
    >
      <Button
        type="button"
        size="sm"
        className="h-10 w-full text-base"
        onClick={onNew}
      >
        <PlusIcon aria-hidden />
        New feedback
      </Button>

      <h3
        id="feedback-history-heading"
        className="text-foreground-secondary text-xs font-medium tracking-wider uppercase"
      >
        Feedback history
      </h3>

      <ul className="grid gap-1">
        {items.map((item) => {
          const { Icon, label } = feedbackKindDetails(item.kind);

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={item.id === activeId ? "true" : undefined}
                className="focus-visible:ring-ring/50 aria-[current=true]:border-cobalt-500 dark:aria-[current=true]:border-cobalt-400 grid w-full gap-1 rounded-xl border border-transparent p-2 text-left outline-none hover:bg-[#E9ECF6] focus-visible:ring-3 aria-[current=true]:bg-[#E9ECF6] dark:hover:bg-[#2B3B5F] dark:aria-[current=true]:bg-[#2B3B5F]"
              >
                <span className="text-foreground-secondary flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Icon aria-hidden size={14} />
                    {label}
                  </span>
                  <span>{item.submittedLabel}</span>
                </span>
                <span className="text-sm font-medium">{item.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
