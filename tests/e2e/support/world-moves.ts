import { z } from "zod";

import { parseJson } from "@/shared/lib/parse-json";

const moveMessageSchema = z.object({
  type: z.literal("move"),
  direction: z.enum(["up", "down", "left", "right"]),
  seq: z.int().nonnegative(),
});

export type CapturedMove = z.output<typeof moveMessageSchema>;

export function readMove(message: string | Buffer): CapturedMove | undefined {
  return parseJson(moveMessageSchema, String(message));
}
