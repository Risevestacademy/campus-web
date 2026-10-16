import { z } from "zod";

import type {
  FeedbackPage,
  FeedbackPerson,
  FeedbackRecord,
  FeedbackSummary,
} from "../types/feedback.types";

const feedbackTypeSchema = z.enum(["bug", "idea", "report"]);
const feedbackStatusSchema = z.enum(["open", "resolved"]);

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

const feedbackContextSchema = z.object({
  path: z.string().optional(),
  mapId: z.string().optional(),
  mapVersion: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

export const feedbackRecordSchema = z.toZod<FeedbackRecord>()(
  z.object({
    ...summaryShape,
    details: z.string(),
    cohortId: z.string().nullable(),
    context: feedbackContextSchema.nullable(),
    userAgent: z.string().nullable(),
    resolvedBy: feedbackPersonSchema.nullable(),
    resolvedAt: z.string().nullable(),
  }),
);

const feedbackListSchema = z.object({
  items: z.array(feedbackSummarySchema),
  meta: z.object({
    page: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
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
