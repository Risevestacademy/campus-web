import type { z } from "zod";

import { ApplicationError } from "./errors";

export const DEFAULT_MAXIMUM_JSON_BYTES = 1_048_576;

type BodyReader = ReadableStreamDefaultReader<Uint8Array>;

function isJsonMediaType(contentType: string | null): boolean {
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();

  return (
    mediaType === "application/json" ||
    Boolean(
      mediaType?.startsWith("application/") && mediaType.endsWith("+json"),
    )
  );
}

function assertDeclaredBodyWithinLimit(
  contentLength: string | null,
  maximumBytes: number,
) {
  if (contentLength === null) {
    return;
  }

  const declaredBytes = Number(contentLength);

  if (Number.isFinite(declaredBytes) && declaredBytes > maximumBytes) {
    throw new ApplicationError("payload_too_large");
  }
}

function cancelReaderBestEffort(reader: BodyReader): Promise<void> {
  return reader.cancel().catch(() => undefined);
}

async function consumeReaderWithinLimit(
  reader: BodyReader,
  maximumBytes: number,
): Promise<string> {
  const decoder = new TextDecoder();
  const decodedChunks: string[] = [];
  let receivedBytes = 0;
  let chunk = await reader.read();

  while (!chunk.done) {
    receivedBytes += chunk.value.byteLength;

    if (receivedBytes > maximumBytes) {
      await cancelReaderBestEffort(reader);
      throw new ApplicationError("payload_too_large");
    }

    decodedChunks.push(decoder.decode(chunk.value, { stream: true }));
    chunk = await reader.read();
  }

  decodedChunks.push(decoder.decode());
  return decodedChunks.join("");
}

async function readStreamWithinLimit(
  stream: ReadableStream<Uint8Array>,
  maximumBytes: number,
): Promise<string> {
  const reader = stream.getReader();

  try {
    return await consumeReaderWithinLimit(reader, maximumBytes);
  } finally {
    reader.releaseLock();
  }
}

async function readRequestBodyWithinLimit(
  request: Request,
  maximumBytes: number,
): Promise<string> {
  assertDeclaredBodyWithinLimit(
    request.headers.get("content-length"),
    maximumBytes,
  );

  if (!request.body) {
    return "";
  }

  return readStreamWithinLimit(request.body, maximumBytes);
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

  const body = await readRequestBodyWithinLimit(request, maximumBytes);

  let input: unknown;

  try {
    input = JSON.parse(body) as unknown;
  } catch {
    throw new ApplicationError("invalid_json");
  }

  return parseInput(schema, input);
}
