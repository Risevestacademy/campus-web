import type { z } from "zod";

import type {
  feedbackKindSchema,
  feedbackSchema,
} from "./schemas/feedback.schema";

export type FeedbackKind = z.output<typeof feedbackKindSchema>;

export interface SentFeedback {
  kind: FeedbackKind;
  title: string;
}

export type NewFeedback = z.output<typeof feedbackSchema>;
