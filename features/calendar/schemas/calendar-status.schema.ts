import { z } from "zod";

import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

// What the panel and the connect card read of the events answer: whether the
// member has a calendar connected. The events themselves are not read yet, so
// they are not kept.
export type CalendarStatus = Simplify<
  Pick<components["schemas"]["CalendarEventsDto"], "connected">
>;

export const calendarStatusSchema = z.toZod<CalendarStatus>()(
  z.object({ connected: z.boolean() }),
);

export function parseCalendarStatus(
  value: unknown,
): CalendarStatus | undefined {
  const parsed = calendarStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
