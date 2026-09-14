export type ApiSuccessStatus = 200 | 201 | 202;

export interface ApiSuccess<T> {
  data: T;
  meta: {
    requestId: string;
  };
}

export type ApiProblemCode =
  | "conflict"
  | "forbidden"
  | "internal_error"
  | "invalid_json"
  | "not_found"
  | "payload_too_large"
  | "rate_limited"
  | "unauthenticated"
  | "unsupported_media_type"
  | "validation_failed";

export interface ValidationIssue {
  code: string;
  message: string;
  path: string;
}

export interface ApiProblem {
  code: ApiProblemCode;
  detail: string;
  issues?: readonly ValidationIssue[];
  requestId: string;
  status: number;
  title: string;
  type: `urn:campus-by-rise:api:problem:${ApiProblemCode}`;
}

export interface AnonymousActor {
  kind: "anonymous";
}

export interface AuthenticatedActor {
  id: string;
  kind: "authenticated";
  permissions: readonly string[];
  roles: readonly string[];
}

export type RequestActor = AnonymousActor | AuthenticatedActor;

export type ApiRouteParameters = Record<string, string | string[] | undefined>;

export interface ApiRouteContext<
  TParameters extends ApiRouteParameters = ApiRouteParameters,
> {
  params: Promise<TParameters>;
}

export type AuthenticateRequest = (
  request: Request,
  requestId: string,
) => Promise<AuthenticatedActor | null>;

export interface RouteExecutionContext<
  TActor extends RequestActor = RequestActor,
> {
  actor: TActor;
  requestId: string;
}

export type ApiRouteHandler<
  TParameters extends ApiRouteParameters = ApiRouteParameters,
> = (
  request: Request,
  context: ApiRouteContext<TParameters>,
) => Promise<Response>;
