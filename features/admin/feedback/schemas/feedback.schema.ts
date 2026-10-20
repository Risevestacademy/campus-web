import { z } from "zod";

import {
  feedbackStatusSchema,
  feedbackTypeSchema,
  paginationMetaWithTotalSchema,
} from "@/core/api/schemas";

import type {
  FeedbackContext,
  FeedbackPage,
  FeedbackPerson,
  FeedbackRecord,
  FeedbackSummary,
} from "../types/feedback.types";

export const feedbackPersonSchema = z.toZod<FeedbackPerson>()(
  z.object({
    id: z.string().min(1),
    email: z.string(),
    displayName: z.string().nullable(),
  }),
);

const summaryShape = {
  id: z.string().min(1),
  type: feedbackTypeSchema,
  title: z.string(),
  about: z.string().nullable(),
  status: feedbackStatusSchema,
  submittedBy: feedbackPersonSchema,
  reportedUser: feedbackPersonSchema.nullable(),
  createdAt: z.string(),
};

export const feedbackSummarySchema = z.toZod<FeedbackSummary>()(
  z.object(summaryShape),
);

const feedbackContextSchema = z.toZod<FeedbackContext>()(
  z.object({ path: z.string().optional() }),
);

export const feedbackRecordSchema = z.toZod<FeedbackRecord>()(
  z.object({
    ...summaryShape,
    details: z.string(),
    context: feedbackContextSchema.nullable(),
    userAgent: z.string().nullable(),
    resolvedBy: feedbackPersonSchema.nullable(),
    resolvedAt: z.string().nullable(),
  }),
);

const feedbackListSchema = z.object({
  items: z.array(feedbackSummarySchema),
  meta: paginationMetaWithTotalSchema,
});

export function parseFeedbackList(
  body: unknown,
): Omit<FeedbackPage, "truncated"> | undefined {
  const parsed = feedbackListSchema.safeParse(body);
  return parsed.success
    ? { items: parsed.data.items, ...parsed.data.meta }
    : undefined;
}

export function parseFeedbackRecord(body: unknown): FeedbackRecord | undefined {
  return feedbackRecordSchema.safeParse(body).data;
}
