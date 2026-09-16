import type { ApiProblem, ApiProblemCode, ValidationIssue } from "./contracts";

type ExpectedApiProblemCode = Exclude<ApiProblemCode, "internal_error">;

const problemDefinitions: Record<
  ApiProblemCode,
  Readonly<{ detail: string; status: number; title: string }>
> = {
  conflict: {
    detail: "The request conflicts with the current resource state.",
    status: 409,
    title: "Conflict",
  },
  forbidden: {
    detail: "You do not have permission to perform this operation.",
    status: 403,
    title: "Forbidden",
  },
  internal_error: {
    detail: "An unexpected error occurred.",
    status: 500,
    title: "Internal Server Error",
  },
  invalid_json: {
    detail: "The request body must contain valid JSON.",
    status: 400,
    title: "Invalid JSON",
  },
  not_found: {
    detail: "The requested resource was not found.",
    status: 404,
    title: "Not Found",
  },
  payload_too_large: {
    detail: "The request body exceeds the endpoint size limit.",
    status: 413,
    title: "Payload Too Large",
  },
  rate_limited: {
    detail: "Too many requests were submitted.",
    status: 429,
    title: "Too Many Requests",
  },
  unauthenticated: {
    detail: "Authentication is required.",
    status: 401,
    title: "Unauthenticated",
  },
  unsupported_media_type: {
    detail:
      "Content-Type must be application/json or an application/*+json media type.",
    status: 415,
    title: "Unsupported Media Type",
  },
  validation_failed: {
    detail: "The request data did not satisfy the endpoint contract.",
    status: 422,
    title: "Validation Failed",
  },
};

export class ApplicationError extends Error {
  constructor(
    readonly code: ExpectedApiProblemCode,
    readonly issues: readonly ValidationIssue[] = [],
  ) {
    super(code);
    this.name = "ApplicationError";
  }
}

export function toApiProblem(reason: unknown, requestId: string): ApiProblem {
  const code =
    reason instanceof ApplicationError ? reason.code : "internal_error";
  const definition = problemDefinitions[code];
  const issues =
    reason instanceof ApplicationError && reason.issues.length > 0
      ? { issues: reason.issues }
      : {};

  return {
    code,
    detail: definition.detail,
    ...issues,
    requestId,
    status: definition.status,
    title: definition.title,
    type: `urn:campus-by-rise:api:problem:${code}`,
  };
}

export function createProblemResponse(problem: ApiProblem): Response {
  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: {
      "content-type": "application/problem+json",
      "x-request-id": problem.requestId,
    },
  });
}
