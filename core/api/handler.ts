import type { Logger } from "@/core/observability";

import type {
  AnonymousActor,
  ApiRouteHandler,
  ApiSuccess,
  ApiSuccessStatus,
  AuthenticatedActor,
  AuthenticateRequest,
  RequestActor,
  RouteExecutionContext,
} from "./contracts";
import {
  ApplicationError,
  createProblemResponse,
  toApiProblem,
} from "./errors";

interface SharedRouteOptions<TInput, TOutput, TActor extends RequestActor> {
  clock?: () => number;
  execute(
    input: TInput,
    context: RouteExecutionContext<TActor>,
  ): Promise<TOutput>;
  generateRequestId?: () => string;
  logger: Logger;
  parse(request: Request): Promise<TInput>;
  routePattern: string;
  successStatus?: ApiSuccessStatus;
}

export type PublicRouteOptions<TInput, TOutput> = SharedRouteOptions<
  TInput,
  TOutput,
  AnonymousActor
>;

export type AuthenticatedRouteOptions<TInput, TOutput> = SharedRouteOptions<
  TInput,
  TOutput,
  AuthenticatedActor
> & {
  authenticate: AuthenticateRequest;
};

type ResolveActor<TActor extends RequestActor> = (
  request: Request,
  requestId: string,
) => Promise<TActor>;

const anonymousActor: AnonymousActor = Object.freeze({
  kind: "anonymous",
});

function getErrorName(reason: unknown): string {
  return reason instanceof Error ? reason.name : "UnknownError";
}

function createRouteHandler<TInput, TOutput, TActor extends RequestActor>(
  options: SharedRouteOptions<TInput, TOutput, TActor>,
  resolveActor: ResolveActor<TActor>,
): ApiRouteHandler {
  const clock = options.clock ?? Date.now;
  const generateRequestId =
    options.generateRequestId ?? (() => globalThis.crypto.randomUUID());
  const successStatus = options.successStatus ?? 200;

  return async (request) => {
    const startedAt = clock();
    const requestId = generateRequestId();

    try {
      const actor = await resolveActor(request, requestId);
      const input = await options.parse(request);
      const data = await options.execute(input, { actor, requestId });
      const responseBody: ApiSuccess<TOutput> = {
        data,
        meta: { requestId },
      };

      options.logger.info("api.request.completed", {
        durationMs: Math.max(0, clock() - startedAt),
        method: request.method,
        requestId,
        route: options.routePattern,
        status: successStatus,
      });

      return Response.json(responseBody, {
        status: successStatus,
        headers: { "x-request-id": requestId },
      });
    } catch (reason) {
      const problem = toApiProblem(reason, requestId);
      const fields = {
        durationMs: Math.max(0, clock() - startedAt),
        method: request.method,
        requestId,
        route: options.routePattern,
        status: problem.status,
      };

      if (reason instanceof ApplicationError) {
        options.logger.warn("api.request.rejected", {
          ...fields,
          errorCode: problem.code,
        });
      } else {
        options.logger.error("api.request.failed", {
          ...fields,
          errorName: getErrorName(reason),
        });
      }

      return createProblemResponse(problem);
    }
  };
}

export function createPublicRoute<TInput, TOutput>(
  options: PublicRouteOptions<TInput, TOutput>,
): ApiRouteHandler {
  return createRouteHandler(options, () => Promise.resolve(anonymousActor));
}

export function createAuthenticatedRoute<TInput, TOutput>(
  options: AuthenticatedRouteOptions<TInput, TOutput>,
): ApiRouteHandler {
  return createRouteHandler(options, async (request, requestId) => {
    const actor = await options.authenticate(request, requestId);

    if (!actor) {
      throw new ApplicationError("unauthenticated");
    }

    return actor;
  });
}
