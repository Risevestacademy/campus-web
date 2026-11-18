import { z } from "zod";

import type { ImportBody, InviteImport } from "../types/invite.types";

const importSchema = z.toZod<ImportBody>()(
  z.object({
    invited: z.number().int().nonnegative(),
    rows: z.array(
      z.object({
        line: z.number().int().positive(),
        email: z.string(),
        outcome: z.enum(["invited", "failed"]),
        emailStatus: z.enum(["sent", "failed", "disabled"]).optional(),
        reason: z.string().optional(),
      }),
    ),
  }),
);

export function parseImport(body: unknown): InviteImport | undefined {
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) return undefined;

  const { invited, rows } = parsed.data;
  return {
    invited,
    notEmailed: rows.filter(
      ({ outcome, emailStatus }) =>
        outcome === "invited" && emailStatus !== "sent",
    ).length,
    failed: rows
      .filter(({ outcome }) => outcome === "failed")
      .map(({ line, email, reason }) => ({
        line,
        email,
        reason: reason ?? "This row was not invited.",
      })),
  };
}
