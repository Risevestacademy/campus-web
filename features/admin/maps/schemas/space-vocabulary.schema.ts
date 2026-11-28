import { z } from "zod";

import type { components } from "@/core/api/client";

type Schemas = components["schemas"];

export const spaceKindSchema = z.toZod<Schemas["SpaceKind"]>()(
  z.enum([
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
  ]),
);

export const spaceAccessSchema = z.toZod<Schemas["SpaceAccess"]>()(
  z.enum(["normal", "designated"]),
);

export const audioModeSchema = z.toZod<Schemas["AudioMode"]>()(
  z.enum(["proximity", "boundary"]),
);

export const mapSyncOutcomeSchema = z.toZod<Schemas["MapSyncOutcome"]>()(
  z.enum(["created", "restored", "updated", "unchanged", "retired"]),
);
