import { z } from "zod";

import type { components } from "../client";

type Schemas = components["schemas"];

export const exceptionCodeSchema = z.toZod<Schemas["ExceptionCode"]>()(
  z.enum([
    "INVALID_ARGUMENT",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "INVITE_ALREADY_ACCEPTED",
    "INVITE_ALREADY_DECLINED",
    "INVITE_REVOKED",
    "INVITE_EXPIRED",
    "SPACE_AT_CAPACITY",
    "INVITE_REQUIRED",
    "ACCOUNT_SUSPENDED",
    "RATE_LIMITED",
    "INTERNAL_ERROR",
  ]),
);

export type ExceptionCode = z.output<typeof exceptionCodeSchema>;

const apiErrorResponseSchema = z.object({
  error: z.object({ code: exceptionCodeSchema }),
});

export function parseExceptionCode(body: unknown): ExceptionCode | undefined {
  return apiErrorResponseSchema.safeParse(body).data?.error.code;
}
