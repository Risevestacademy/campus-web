import type { z } from "zod";

import { ApplicationError } from "./errors";

export const DEFAULT_MAXIMUM_JSON_BYTES = 1_048_576;

function isJsonMediaType(contentType: string | null): boolean {
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();

  return (
    mediaType === "application/json" ||
    Boolean(
      mediaType?.startsWith("application/") && mediaType.endsWith("+json"),
    )
  );
}

function assertBodySize(request: Request, body: string, maximumBytes: number) {
  const declaredBytes = Number(request.headers.get("content-length"));
  const actualBytes = new TextEncoder().encode(body).byteLength;

  if (
    (Number.isFinite(declaredBytes) && declaredBytes > maximumBytes) ||
    actualBytes > maximumBytes
  ) {
    throw new ApplicationError("payload_too_large");
  }
}

export function parseInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new ApplicationError(
      "validation_failed",
      result.error.issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        path: issue.path.length === 0 ? "$" : issue.path.map(String).join("."),
      })),
    );
  }

  return result.data;
}

export async function parseJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
  maximumBytes = DEFAULT_MAXIMUM_JSON_BYTES,
): Promise<z.output<TSchema>> {
  if (!isJsonMediaType(request.headers.get("content-type"))) {
    throw new ApplicationError("unsupported_media_type");
  }

  const body = await request.text();
  assertBodySize(request, body, maximumBytes);

  let input: unknown;

  try {
    input = JSON.parse(body) as unknown;
  } catch {
    throw new ApplicationError("invalid_json");
  }

  return parseInput(schema, input);
}
