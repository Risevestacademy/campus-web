import { z } from "zod";

import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";
import { paginationMetaSchema } from "@/core/api/schemas";

type Schemas = components["schemas"];

export const ROOM_LINK_TITLE_LIMIT = 128;
const ROOM_LINK_CODE = /^[A-Za-z0-9]{10}$/;

// What the dialog shows of a link it has just made: the words to paste, and
// where it leads. The audience, cohort and space ids, and the run times are
// not read.
type RawRoomLink = Simplify<
  Pick<Schemas["RoomLinkDto"], "code" | "url" | "title" | "spaceName">
>;

export type CreatedRoomLink = Readonly<RawRoomLink>;

const roomLinkSchema = z.toZod<RawRoomLink>()(
  z.object({
    code: z.string().regex(ROOM_LINK_CODE),
    url: z.string().max(2048),
    title: z.string().max(ROOM_LINK_TITLE_LIMIT * 2),
    spaceName: z.string().max(300),
  }),
);

// The address is campus-api's own, so it is only checked to be the join page
// of this very code, over http or https, before it is shown as a link.
export function parseCreatedRoomLink(
  value: unknown,
): CreatedRoomLink | undefined {
  const parsed = roomLinkSchema.safeParse(value);
  if (!parsed.success) return undefined;
  try {
    const url = new URL(parsed.data.url);
    const web = url.protocol === "https:" || url.protocol === "http:";
    return web && url.pathname === `/join/${parsed.data.code}`
      ? parsed.data
      : undefined;
  } catch {
    return undefined;
  }
}

// What the admin's list of spaces is read for: which spaces can take a link,
// by id and name.
type RawSpace = Simplify<
  Pick<Schemas["SpaceResponseDto"], "id" | "name" | "kind" | "isMapDefault">
>;

export type LinkableSpace = Readonly<{ id: string; name: string }>;

const kinds = [
  "open",
  "classroom",
  "meeting_room",
  "mentor_pod",
  "live_coding",
  "desk",
  "town_hall",
  "notice_board",
  "stage",
  "help_desk",
] as const;

const spaceSchema = z.toZod<RawSpace>()(
  z.object({
    id: z.string().min(1).max(64),
    name: z.string().max(300),
    kind: z.enum(kinds).nullable(),
    isMapDefault: z.boolean(),
  }),
);

const spacePageSchema = z.object({
  items: z.array(z.unknown()),
  meta: paginationMetaSchema,
});

export type LinkableSpacePage = Readonly<{
  spaces: readonly LinkableSpace[];
  page: number;
  totalPages: number;
}>;

// Only a space that is set up and is not the map's corridors takes a link:
// campus-api refuses any other.
export function parseLinkableSpacePage(
  value: unknown,
): LinkableSpacePage | undefined {
  const page = spacePageSchema.safeParse(value);
  if (!page.success) return undefined;

  const spaces: LinkableSpace[] = [];
  for (const item of page.data.items) {
    const space = spaceSchema.safeParse(item);
    if (space.success && space.data.kind !== null && !space.data.isMapDefault) {
      spaces.push({ id: space.data.id, name: space.data.name });
    }
  }
  return {
    spaces,
    page: page.data.meta.page,
    totalPages: page.data.meta.totalPages,
  };
}
