import { z } from "zod";

import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

// What the page reads of an entry: which cohort to join and which space to
// walk to. The title, window and pass state are campus-api's and world's to
// act on, so they are not kept.
export type RoomLinkEntry = Simplify<
  Pick<components["schemas"]["RoomLinkEntryDto"], "cohortId" | "spaceKey">
>;

const ROOM_LINK_CODE = /^[A-Za-z0-9]{10}$/;

// campus-api answers anything but ten letters and digits with a 400, so a
// code of another shape never leaves the app.
export function parseRoomLinkCode(value: string): string | undefined {
  return ROOM_LINK_CODE.test(value) ? value : undefined;
}

export const roomLinkEntrySchema = z.toZod<RoomLinkEntry>()(
  z.object({
    cohortId: z.string().min(1),
    spaceKey: z.string().min(1).max(64),
  }),
);

export function parseRoomLinkEntry(value: unknown): RoomLinkEntry | undefined {
  const parsed = roomLinkEntrySchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
