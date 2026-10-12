import type { Icon } from "@phosphor-icons/react";
import { BellIcon } from "@phosphor-icons/react/dist/ssr/Bell";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr/MapTrifold";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";

import { Button } from "@/shared/ui/button";

import { feedbackKindDetails } from "./feedback-kinds";
import type { FeedbackItem } from "./types";

const NEXT_STEPS: readonly {
  Icon: Icon;
  text: string;
  className: string;
}[] = [
  {
    Icon: CheckIcon,
    text: "The team reviews new feedback every week",
    className: "text-success-500",
  },
  {
    Icon: BellIcon,
    text: "You'll get a notification when it ships",
    className: "text-primary dark:text-cobalt-300",
  },
];

export function FeedbackSent({
  firstName,
  item,
  onSendAnother,
  onBack,
}: {
  firstName?: string;
  item: FeedbackItem;
  onSendAnother: () => void;
  onBack: () => void;
}) {
  const { noun } = feedbackKindDetails(item.kind);

  return (
    <div
      role="status"
      className="mx-auto grid max-w-xl justify-items-center gap-5 py-10 text-center"
    >
      <span className="bg-success-100 text-success-500 dark:bg-success-900/60 grid size-16 place-items-center rounded-full">
        <CheckIcon aria-hidden size={30} />
      </span>

      <h2 className="font-display text-3xl font-semibold">
        {firstName ? `Thanks, ${firstName}. We got it` : "Thanks. We got it"}
      </h2>

      <p className="text-foreground-secondary text-lg">
        Your {noun} “{item.title}” is with the Rise team. You can find it in
        Feedback history.
      </p>

      <section
        aria-labelledby="what-happens-next-heading"
        className="grid w-full gap-3 rounded-2xl bg-[#EFFAFF] p-5 text-left dark:bg-[#2B3B5F]"
      >
        <h3
          id="what-happens-next-heading"
          className="text-foreground-secondary text-xs font-medium tracking-wider uppercase"
        >
          What happens next
        </h3>
        <ul className="grid gap-2.5">
          {NEXT_STEPS.map(({ Icon, text, className }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <Icon aria-hidden size={20} className={className} />
              {text}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 px-6 text-base dark:border-[#2B3B5F]"
          onClick={onSendAnother}
        >
          <PlusIcon aria-hidden />
          Send another
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-11 px-6 text-base"
          onClick={onBack}
        >
          <MapTrifoldIcon aria-hidden />
          Back to campus
        </Button>
      </div>
    </div>
  );
}
