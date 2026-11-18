import { z } from "zod";

// A route segment is text until it is parsed: only an account id reaches the
// API.
export function parsePersonId(value: unknown): string | undefined {
  return z.uuid().safeParse(value).data;
}
