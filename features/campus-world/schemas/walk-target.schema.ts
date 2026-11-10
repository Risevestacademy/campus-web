import { z } from "zod";

// A space key from the URL. world knows which keys are drawn and refuses the
// rest, so the app only bounds the shape it will put in a frame.
const spaceKeySchema = z.string().trim().min(1).max(64);

export function parseWalkTargetSpace(
  value: string | undefined,
): string | undefined {
  const parsed = spaceKeySchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
