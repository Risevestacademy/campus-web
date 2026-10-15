import type * as z from "zod";

export function parseJson<Schema extends z.ZodType>(
  schema: Schema,
  text: string | null | undefined,
): z.output<Schema> | undefined {
  if (!text) return undefined;

  return schema.safeParse(readJson(text)).data;
}

function readJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
