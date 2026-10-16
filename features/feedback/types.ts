import type { z } from "zod";

import type {
  feedbackKindSchema,
  feedbackSchema,
} from "./schemas/feedback.schema";

export type FeedbackKind = z.output<typeof feedbackKindSchema>;

export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  title: string;
  details: string;
  location: string;
  submittedLabel: string;
}

export type NewFeedback = z.output<typeof feedbackSchema>;
