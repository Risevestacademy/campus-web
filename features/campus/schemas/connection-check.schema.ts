import { z } from "zod";

// Hand-written: world publishes no HTTP schema for this route, so there is
// no generated type to bind with z.toZod.
const connectionCheckGrantSchema = z.object({
  url: z.string().min(1),
  token: z.string().min(1),
});

export type ConnectionCheckGrant = z.output<typeof connectionCheckGrantSchema>;

const mediaNotConfiguredSchema = z.object({
  error: z.object({ code: z.literal("MEDIA_NOT_CONFIGURED") }),
});

export function parseConnectionCheckGrant(
  body: unknown,
): ConnectionCheckGrant | undefined {
  return connectionCheckGrantSchema.safeParse(body).data;
}

export function isMediaNotConfigured(body: unknown): boolean {
  return mediaNotConfiguredSchema.safeParse(body).success;
}
