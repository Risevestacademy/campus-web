import { feedbackKindDetails } from "./feedback-kinds";
import type { FeedbackItem } from "./types";

export function FeedbackDetail({ item }: { item: FeedbackItem }) {
  const { Icon, label } = feedbackKindDetails(item.kind);

  return (
    <article aria-labelledby="feedback-detail-heading" className="grid gap-5">
      <p className="text-foreground-secondary flex items-center gap-2 text-sm">
        <Icon aria-hidden size={16} />
        {label}
        <span aria-hidden>·</span>
        {item.submittedLabel}
      </p>

      <h2
        id="feedback-detail-heading"
        className="font-display text-2xl font-semibold"
      >
        {item.title}
      </h2>

      <section aria-labelledby="feedback-detail-details" className="grid gap-2">
        <h3
          id="feedback-detail-details"
          className="text-foreground-secondary text-xs font-medium tracking-wider uppercase"
        >
          Details
        </h3>
        <p className="whitespace-pre-wrap">
          {item.details || (
            <span className="text-foreground-muted">No details added.</span>
          )}
        </p>
      </section>

      {item.reported ? (
        <section
          aria-labelledby="feedback-detail-reported"
          className="grid gap-2"
        >
          <h3
            id="feedback-detail-reported"
            className="text-foreground-secondary text-xs font-medium tracking-wider uppercase"
          >
            Who you reported
          </h3>
          <p>{item.reported}</p>
        </section>
      ) : null}

      {item.location ? (
        <section
          aria-labelledby="feedback-detail-location"
          className="grid gap-2"
        >
          <h3
            id="feedback-detail-location"
            className="text-foreground-secondary text-xs font-medium tracking-wider uppercase"
          >
            Where in Campus
          </h3>
          <p>{item.location}</p>
        </section>
      ) : null}
    </article>
  );
}
