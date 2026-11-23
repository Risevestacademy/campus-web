import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

type Schemas = components["schemas"];

export type MediaKind = Schemas["MediaKind"];

// One kind's types and size, from `GET /v1/uploads/limits`.
export type UploadLimits = Simplify<Schemas["UploadKindLimitsDto"]>;

// Where to PUT one file, as `POST /v1/uploads` signed it.
export type SignedUpload = Simplify<
  Pick<Schemas["UploadDto"], "mediaId" | "uploadUrl" | "headers">
>;

export type UploadProblem =
  | { kind: "type-not-allowed"; allowed: string[] }
  | { kind: "too-large"; maxBytes: number }
  | { kind: "rate-limited" }
  | { kind: "signed-out" }
  | { kind: "cancelled" }
  | { kind: "unavailable" };

export type UploadResult =
  | { kind: "uploaded"; mediaId: string }
  | { kind: "problem"; problem: UploadProblem };

// How a PUT to storage ended.
export type PutOutcome =
  | { kind: "answered"; status: number }
  | { kind: "aborted" }
  | { kind: "failed" };

export type PutFile = (request: {
  url: string;
  headers: Record<string, string>;
  file: Blob;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}) => Promise<PutOutcome>;
