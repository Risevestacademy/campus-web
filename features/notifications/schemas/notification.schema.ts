import { z } from "zod";

import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";
import { paginationMetaWithTotalSchema } from "@/core/api/schemas";
import type { NotificationKind } from "@/core/realtime";

type Dto = components["schemas"]["NotificationDto"];

// What the list reads of a notification: which, what kind, for an entry
// request where, whether it is read, and when. The notice or request it points
// at is not read: a notice's text has no route to fetch it yet.
export type Notification = Simplify<
  Pick<Dto, "id" | "context" | "read" | "createdAt"> & {
    kind: NotificationKind;
  }
>;

// A kind campus-api adds later reads as "unknown", so it shows as a plain
// alert instead of failing the whole page.
const kindSchema = z.toZod<NotificationKind>()(
  z.union([
    z.enum([
      "notice_posted",
      "entry_request_admitted",
      "entry_request_declined",
    ]),
    z.string().transform(() => "unknown" as const),
  ]),
);

const notificationSchema = z.toZod<Notification>()(
  z.object({
    id: z.string().min(1),
    kind: kindSchema,
    context: z
      .object({ cohortId: z.string(), spaceKey: z.string() })
      .nullable(),
    read: z.boolean(),
    createdAt: z.string(),
  }),
);

const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  meta: paginationMetaWithTotalSchema,
});

export interface NotificationPage {
  notifications: Notification[];
  page: number;
  totalPages: number;
  total: number;
}

export function parseNotificationPage(
  body: unknown,
): NotificationPage | undefined {
  const parsed = notificationPageSchema.safeParse(body);
  if (!parsed.success) return undefined;

  const { items, meta } = parsed.data;
  return {
    notifications: items,
    page: meta.page,
    totalPages: meta.totalPages,
    total: meta.total,
  };
}
