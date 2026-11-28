import { z } from "zod";

import { changedFields } from "@/shared/lib/changed-fields";
import { type FormInvalid, parseForm } from "@/shared/lib/forms";

import type {
  AudioMode,
  SpaceAccess,
  SpaceChanges,
  SpaceKind,
  SpaceSettings,
} from "../types/maps.types";
import {
  audioModeSchema,
  spaceAccessSchema,
  spaceKindSchema,
} from "./space-vocabulary.schema";

const MAX_NAME_LENGTH = 128;

export interface SpaceFieldValues {
  name: string;
  kind: SpaceKind | null;
  access: SpaceAccess;
  audioMode: AudioMode;
}

const spaceFieldsSchema = z.toZod<SpaceFieldValues>()(
  z.object({
    name: z
      .string()
      .trim()
      .min(1, "Give the space a name.")
      .max(MAX_NAME_LENGTH, `Keep the name to ${MAX_NAME_LENGTH} characters.`),
    kind: z
      .union([z.literal(""), spaceKindSchema])
      .transform((value) => (value === "" ? null : value)),
    access: spaceAccessSchema,
    audioMode: audioModeSchema,
  }),
);

export type SpaceEditRead =
  | { kind: "valid"; changes: SpaceChanges }
  | { kind: "unchanged" }
  | FormInvalid<SpaceFieldValues>;

export function parseSpaceEdit(
  space: SpaceSettings,
  form: FormData,
): SpaceEditRead {
  const read = parseForm(spaceFieldsSchema, form);
  if (read.kind === "invalid") return read;

  const changes = changedFields(space, read.data);
  return Object.keys(changes).length > 0
    ? { kind: "valid", changes }
    : { kind: "unchanged" };
}
