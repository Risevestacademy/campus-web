import { z } from "zod";

import { paginationMetaSchema } from "@/core/api/schemas";

import type {
  CampusMapRow,
  MapSyncDesks,
  MapSyncMap,
  MapSyncResult,
  MapSyncSpaces,
  SpaceSettings,
  SyncedSpace,
} from "../types/maps.types";
import {
  audioModeSchema,
  mapSyncOutcomeSchema,
  spaceAccessSchema,
  spaceKindSchema,
} from "./space-vocabulary.schema";

const keySchema = z.string().min(1);

export const spaceSettingsSchema = z.toZod<SpaceSettings>()(
  z.object({
    id: z.string().min(1),
    mapId: z.string().min(1),
    key: keySchema,
    name: z.string(),
    kind: spaceKindSchema.nullable(),
    access: spaceAccessSchema,
    audioMode: audioModeSchema,
    capacity: z.number().int().positive().nullable(),
    isMapDefault: z.boolean(),
  }),
);

const campusMapSchema = z.toZod<CampusMapRow>()(
  z.object({
    id: z.string().min(1),
    key: keySchema,
    name: z.string(),
    isEntry: z.boolean(),
    retiredAt: z.iso.datetime({ offset: true }).nullable(),
    syncedVersion: z.string().min(1).nullable(),
    publishedVersion: z.string().min(1).nullable(),
  }),
);

export function parseCampusMaps(body: unknown): CampusMapRow[] | undefined {
  return z.array(campusMapSchema).safeParse(body).data;
}

const spacePageSchema = z.object({
  items: z.array(spaceSettingsSchema),
  meta: paginationMetaSchema,
});

export function parseSpacePage(
  body: unknown,
): { spaces: SpaceSettings[]; totalPages: number } | undefined {
  const parsed = spacePageSchema.safeParse(body);
  return parsed.success
    ? { spaces: parsed.data.items, totalPages: parsed.data.meta.totalPages }
    : undefined;
}

const syncedSpaceSchema = z.toZod<SyncedSpace>()(
  z.object({
    key: keySchema,
    name: z.string(),
    kind: spaceKindSchema.nullable(),
  }),
);

const syncSpacesSchema = z.toZod<MapSyncSpaces>()(
  z.object({
    added: z.array(syncedSpaceSchema),
    restored: z.array(keySchema),
    retired: z.array(keySchema),
    needsKind: z.array(keySchema),
  }),
);

const syncDesksSchema = z.toZod<MapSyncDesks>()(
  z.object({
    added: z.array(keySchema),
    restored: z.array(keySchema),
    retired: z.array(keySchema),
  }),
);

const syncMapSchema = z.toZod<MapSyncMap>()(
  z.object({
    outcome: mapSyncOutcomeSchema,
    key: keySchema,
    isEntry: z.boolean(),
    spaces: syncSpacesSchema,
    desks: syncDesksSchema,
  }),
);

const syncResultSchema = z.toZod<MapSyncResult>()(
  z.object({
    dryRun: z.boolean(),
    changed: z.boolean(),
    maps: z.array(syncMapSchema),
  }),
);

export function parseSyncResult(body: unknown): MapSyncResult | undefined {
  return syncResultSchema.safeParse(body).data;
}

// A 409 lists what is wrong with the published maps, one line each, for
// whoever publishes them. The same status with no list means another sync is
// running.
const MAX_MAP_PROBLEMS = 50;
const MAX_PROBLEM_LENGTH = 500;
const rejectionSchema = z.object({
  error: z.object({
    details: z.object({
      problems: z.array(z.string().min(1)).min(1),
    }),
  }),
});

// A long list is cut rather than refused, so it still reads as a rejection
// and not as a sync that is running.
export function parseMapProblems(body: unknown): string[] | undefined {
  return rejectionSchema
    .safeParse(body)
    .data?.error.details.problems.slice(0, MAX_MAP_PROBLEMS)
    .map((problem) => problem.slice(0, MAX_PROBLEM_LENGTH));
}

const unavailableSchema = z.object({
  error: z.object({
    details: z.object({ reason: z.enum(["not_configured", "unreachable"]) }),
  }),
});

export function parseUnavailableReason(
  body: unknown,
): "not_configured" | "unreachable" | undefined {
  return unavailableSchema.safeParse(body).data?.error.details.reason;
}
