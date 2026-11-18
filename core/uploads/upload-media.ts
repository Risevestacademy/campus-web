import type { ApiClient } from "@/core/api/client";

import { putFile } from "./put-file";
import type {
  MediaKind,
  PutFile,
  SignedUpload,
  UploadProblem,
  UploadResult,
} from "./types";
import {
  allowedTypesOf,
  maxBytesOf,
  parseSignedUpload,
  parseUploadLimits,
} from "./upload.schema";

type Signing =
  | { kind: "signed"; upload: SignedUpload }
  | { kind: "problem"; problem: UploadProblem };

const problem = (value: UploadProblem): UploadResult => ({
  kind: "problem",
  problem: value,
});

async function checkAgainstLimits(
  api: ApiClient,
  kind: MediaKind,
  file: Blob,
): Promise<UploadProblem | undefined> {
  const { data, response } = await api.GET("/v1/uploads/limits");
  if (response.status === 401) return { kind: "signed-out" };
  const limits = response.ok
    ? parseUploadLimits(data)?.find((entry) => entry.kind === kind)
    : undefined;
  if (!limits) return { kind: "unavailable" };
  if (!limits.contentTypes.includes(file.type)) {
    return { kind: "type-not-allowed", allowed: limits.contentTypes };
  }
  if (file.size > limits.maxBytes) {
    return { kind: "too-large", maxBytes: limits.maxBytes };
  }
  return undefined;
}

async function sign(
  api: ApiClient,
  kind: MediaKind,
  file: Blob,
  fileName: string | undefined,
): Promise<Signing> {
  const { data, error, response } = await api.POST("/v1/uploads", {
    body: {
      kind,
      contentType: file.type,
      sizeBytes: file.size,
      ...(fileName ? { fileName } : {}),
    },
  });
  if (response.ok) {
    const upload = parseSignedUpload(data);
    return upload
      ? { kind: "signed", upload }
      : { kind: "problem", problem: { kind: "unavailable" } };
  }
  switch (response.status) {
    case 401:
      return { kind: "problem", problem: { kind: "signed-out" } };
    case 413:
      return {
        kind: "problem",
        problem: { kind: "too-large", maxBytes: maxBytesOf(error) ?? 0 },
      };
    case 415:
      return {
        kind: "problem",
        problem: {
          kind: "type-not-allowed",
          allowed: allowedTypesOf(error) ?? [],
        },
      };
    case 429:
      return { kind: "problem", problem: { kind: "rate-limited" } };
    default:
      return { kind: "problem", problem: { kind: "unavailable" } };
  }
}

// Uploads one file for `kind` and answers its mediaId, which the caller hands
// to the endpoint that uses it. Checks the file against campus-api's limits
// first, signs a PUT, and sends the file straight to storage with exactly the
// signed headers. A 403 from storage is an expired URL: it signs again once.
export async function uploadMedia({
  api,
  file,
  fileName,
  kind,
  onProgress,
  put = putFile,
  signal,
}: {
  api: ApiClient;
  file: Blob;
  fileName?: string;
  kind: MediaKind;
  onProgress?: (fraction: number) => void;
  put?: PutFile;
  signal?: AbortSignal;
}): Promise<UploadResult> {
  try {
    const refused = await checkAgainstLimits(api, kind, file);
    if (refused) return problem(refused);

    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) return problem({ kind: "cancelled" });
      const signing = await sign(api, kind, file, fileName);
      if (signing.kind === "problem") return problem(signing.problem);

      onProgress?.(0);
      const outcome = await put({
        url: signing.upload.uploadUrl,
        headers: signing.upload.headers,
        file,
        onProgress,
        signal,
      });
      if (outcome.kind === "aborted") return problem({ kind: "cancelled" });
      if (
        outcome.kind === "answered" &&
        outcome.status >= 200 &&
        outcome.status < 300
      ) {
        return { kind: "uploaded", mediaId: signing.upload.mediaId };
      }
      if (outcome.kind !== "answered" || outcome.status !== 403) break;
    }
    return problem({ kind: "unavailable" });
  } catch {
    return problem({ kind: "unavailable" });
  }
}
