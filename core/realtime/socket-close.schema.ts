import { z } from "zod";

import type { SocketClose } from "./close-policy";

// 1000-4999 is the registered close-code range; a close reason may be at
// most 123 bytes. Each field is judged alone: a world close carries both,
// so losing one must not lose the other's meaning.
const closeCodeSchema = z.int().min(1000).max(4999);
const closeReasonSchema = z
  .string()
  .refine(
    (reason) => new TextEncoder().encode(reason).byteLength <= 123,
    "Close reason exceeds 123 UTF-8 bytes.",
  );

export function parseSocketClose(code: unknown, reason: unknown): SocketClose {
  return {
    code: closeCodeSchema.safeParse(code).data ?? 0,
    reason: closeReasonSchema.safeParse(reason).data ?? "",
  };
}
