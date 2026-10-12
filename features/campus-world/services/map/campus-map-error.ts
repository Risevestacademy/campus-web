import type {
  CampusWorldMapErrorKind,
  CampusWorldMapFailureProperties,
} from "@/core/analytics/events";

export interface CampusMapFailure {
  errorKind: CampusWorldMapErrorKind;
  mapId: string | null;
}

export class CampusMapError extends Error {
  readonly kind: CampusWorldMapErrorKind;
  readonly mapId: string | null;

  constructor(
    kind: CampusWorldMapErrorKind,
    message: string,
    options: { cause?: unknown; mapId?: string | null } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "CampusMapError";
    this.kind = kind;
    this.mapId = options.mapId ?? null;
  }
}

export function campusMapFailureOf(error: unknown): CampusMapFailure {
  return error instanceof CampusMapError
    ? { errorKind: error.kind, mapId: error.mapId }
    : { errorKind: "render", mapId: null };
}

export function failureEventProperties(
  failure: CampusMapFailure,
): CampusWorldMapFailureProperties {
  return { error_kind: failure.errorKind, map_id: failure.mapId };
}
