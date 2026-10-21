import { z } from "zod";

export const CLIENT_ADDRESS_HEADER = "x-forwarded-for";

// Railway documents X-Real-IP as the client address and overwrites it at the
// edge. Its X-Forwarded-For chain is undocumented, so it is never trusted.
const EDGE_CLIENT_ADDRESS_HEADER = "x-real-ip";
const clientAddressSchema = z.union([z.ipv4(), z.ipv6()]);

export function readClientAddress(
  headers: Pick<Headers, "get">,
): string | undefined {
  const parsed = clientAddressSchema.safeParse(
    headers.get(EDGE_CLIENT_ADDRESS_HEADER)?.trim(),
  );
  return parsed.success ? parsed.data : undefined;
}
