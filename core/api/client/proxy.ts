import "server-only";

import type { ClientOptions } from "openapi-fetch";

import type { Logger } from "@/core/observability";

import { CLIENT_ADDRESS_HEADER, readClientAddress } from "./client-address";
import type { components } from "./generated/schema";
import {
  appendRefreshAttemptedCookie,
  copyAuthSetCookies,
  expireCookies,
  findAuthCookies,
  hasSessionCookie,
  type ScopedCookie,
  startsSession,
} from "./proxy-cookie-policy";
import {
  appendReturnCookie,
  type ParseReturnTo,
  readRequestedReturnTo,
  removeRequestedReturnTo,
  rewriteSuccessfulOauthDestination,
} from "./proxy-oauth-policy";
import { findForwardedRoute } from "./upstream-routes";

type ExceptionCode = components["schemas"]["ExceptionCode"];

const AUTH_ROUTE_PREFIX = "/v1/auth/";
const GOOGLE_AUTH_ROUTE = "/v1/auth/google";
const GOOGLE_CALLBACK_ROUTE = "/v1/auth/google/callback";
const REFRESH_ROUTE = "/v1/auth/refresh";
const REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-unmodified-since",
  "range",
];
const RESPONSE_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-language",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "expires",
  "last-modified",
  "location",
  "ratelimit",
  "ratelimit-policy",
  "ratelimit-remaining",
  "ratelimit-reset",
  "retry-after",
  "vary",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

interface ApiProxyOptions {
  baseUrl: string | (() => string);
  clock?: () => number;
  cookiesSpentBySignIn?: readonly ScopedCookie[];
  fetch?: ClientOptions["fetch"];
  generateRequestId?: () => string;
  logger: Logger;
  parseReturnTo: ParseReturnTo;
}

function resolveBaseUrl(baseUrl: string | (() => string)): string {
  return typeof baseUrl === "function" ? baseUrl() : baseUrl;
}

interface ApiError {
  code: ExceptionCode;
  message: string;
}

interface Rejection {
  error: ApiError;
  errorCode: string;
  status: number;
}

const UNKNOWN_ROUTE: Rejection = {
  error: { code: "NOT_FOUND", message: "API route not found." },
  errorCode: "unknown_route",
  status: 404,
};
const CROSS_ORIGIN: Rejection = {
  error: { code: "FORBIDDEN", message: "Cross-origin request rejected." },
  errorCode: "cross_origin",
  status: 403,
};
const API_UNAVAILABLE: ApiError = {
  code: "INTERNAL_ERROR",
  message: "API is unavailable.",
};

interface ApiProxyContext {
  params: Promise<{ path: string[] }>;
}

interface StreamingRequestInit extends RequestInit {
  duplex: "half";
}

function copyHeaders(source: Headers, names: readonly string[]): Headers {
  const headers = new Headers();

  for (const name of names) {
    const value = source.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  return headers;
}

function isPrivateResponse(
  route: string,
  request: Request,
  responseHeaders: Headers,
): boolean {
  return (
    route.startsWith(AUTH_ROUTE_PREFIX) ||
    hasSessionCookie(request) ||
    responseHeaders.has("set-cookie")
  );
}

function forbidCaching(responseHeaders: Headers): void {
  responseHeaders.set("cache-control", "private, no-store");
  responseHeaders.delete("expires");
}

function createUpstreamUrl(
  baseUrl: string,
  path: readonly string[],
  requestUrl: string,
  route: string,
): URL {
  const encodedPath = path
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const upstreamUrl = new URL(`/${encodedPath}`, baseUrl);
  upstreamUrl.search = new URL(requestUrl).search;

  if (route === GOOGLE_AUTH_ROUTE) removeRequestedReturnTo(upstreamUrl);

  return upstreamUrl;
}

function createUpstreamHeaders(
  request: Request,
  requestId: string,
  clientAddress: string | undefined,
): Headers {
  const headers = copyHeaders(request.headers, REQUEST_HEADERS);
  const authCookies = findAuthCookies(request.headers.get("cookie"));

  headers.set("x-request-id", requestId);

  if (clientAddress) {
    headers.set(CLIENT_ADDRESS_HEADER, clientAddress);
  }

  if (authCookies.length > 0) {
    headers.set("cookie", authCookies.join("; "));
  }

  return headers;
}

function createUpstreamRequest(
  request: Request,
  requestId: string,
  clientAddress: string | undefined,
  url: URL,
): Request {
  const requestInit: StreamingRequestInit = {
    body: request.body,
    duplex: "half",
    headers: createUpstreamHeaders(request, requestId, clientAddress),
    method: request.method,
    redirect: "manual",
    signal: request.signal,
  };
  return new Request(url, requestInit);
}

function isCrossOriginUnsafeRequest(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (!forwardedHost || !forwardedProto) return true;

  const requestOrigin = `${forwardedProto}://${forwardedHost}`;

  return origin !== requestOrigin;
}

function describeClientAddress(
  clientAddress: string | undefined,
): "absent" | "forwarded" {
  return clientAddress ? "forwarded" : "absent";
}

function createErrorResponse(
  requestId: string,
  status: number,
  error: ApiError,
): Response {
  const headers = new Headers({ "x-request-id": requestId });
  forbidCaching(headers);
  return Response.json({ error }, { headers, status });
}

function getErrorName(reason: unknown): string {
  return reason instanceof Error ? reason.name : "UnknownError";
}

export function createApiProxy(options: ApiProxyOptions) {
  const clock = options.clock ?? Date.now;
  const cookiesSpentBySignIn = options.cookiesSpentBySignIn ?? [];
  const fetchUpstream = options.fetch ?? ((request: Request) => fetch(request));
  const generateRequestId =
    options.generateRequestId ?? (() => globalThis.crypto.randomUUID());

  return async (request: Request, context: ApiProxyContext) => {
    const startedAt = clock();
    const requestId = generateRequestId();
    const { path } = await context.params;
    const secure = new URL(request.url).protocol === "https:";

    // Logs carry the route template, never the requested path: a mistyped
    // URL can hold an invite token or an email address.
    const reject = (rejection: Rejection, route?: string) => {
      options.logger.warn("api.proxy.rejected", {
        durationMs: Math.max(0, clock() - startedAt),
        errorCode: rejection.errorCode,
        method: request.method,
        requestId,
        ...(route && { route }),
        status: rejection.status,
      });

      return createErrorResponse(requestId, rejection.status, rejection.error);
    };

    const route = findForwardedRoute(path);
    if (!route) return reject(UNKNOWN_ROUTE);
    if (isCrossOriginUnsafeRequest(request)) return reject(CROSS_ORIGIN, route);

    const clientAddress = readClientAddress(request.headers);

    try {
      const upstreamRequest = createUpstreamRequest(
        request,
        requestId,
        clientAddress,
        createUpstreamUrl(
          resolveBaseUrl(options.baseUrl),
          path,
          request.url,
          route,
        ),
      );
      const upstreamResponse = await fetchUpstream(upstreamRequest);
      const responseHeaders = copyHeaders(
        upstreamResponse.headers,
        RESPONSE_HEADERS,
      );

      copyAuthSetCookies(upstreamResponse.headers, responseHeaders, secure);

      if (
        route === REFRESH_ROUTE &&
        request.method === "POST" &&
        upstreamResponse.ok
      ) {
        appendRefreshAttemptedCookie(responseHeaders, secure);
      }

      if (route === GOOGLE_AUTH_ROUTE) {
        appendReturnCookie(
          responseHeaders,
          readRequestedReturnTo(request.url, options.parseReturnTo),
          secure,
        );
      }

      if (route === GOOGLE_CALLBACK_ROUTE) {
        rewriteSuccessfulOauthDestination(
          request,
          responseHeaders,
          options.parseReturnTo,
        );
        appendReturnCookie(responseHeaders, undefined, secure);

        if (startsSession(upstreamResponse.headers)) {
          expireCookies(responseHeaders, cookiesSpentBySignIn, secure);
        }
      }

      if (isPrivateResponse(route, request, responseHeaders)) {
        forbidCaching(responseHeaders);
      }

      responseHeaders.set("x-request-id", requestId);
      options.logger.info("api.proxy.completed", {
        clientAddress: describeClientAddress(clientAddress),
        durationMs: Math.max(0, clock() - startedAt),
        method: request.method,
        requestId,
        route,
        status: upstreamResponse.status,
      });

      return new Response(upstreamResponse.body, {
        headers: responseHeaders,
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
      });
    } catch (reason) {
      options.logger.error("api.proxy.failed", {
        clientAddress: describeClientAddress(clientAddress),
        durationMs: Math.max(0, clock() - startedAt),
        errorName: getErrorName(reason),
        method: request.method,
        requestId,
        route,
        status: 502,
      });

      const response = createErrorResponse(requestId, 502, API_UNAVAILABLE);

      if (route === GOOGLE_CALLBACK_ROUTE) {
        appendReturnCookie(response.headers, undefined, secure);
      }

      return response;
    }
  };
}
