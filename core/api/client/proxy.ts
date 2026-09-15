import "server-only";

import type { ClientOptions } from "openapi-fetch";

import type { Logger } from "@/core/observability";

const ACCESS_TOKEN_COOKIE_NAME = "accessToken";
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
const MANAGED_ACCESS_TOKEN_ATTRIBUTES = new Set([
  "domain",
  "httponly",
  "path",
  "samesite",
  "secure",
]);

interface ApiProxyOptions {
  baseUrl: string | (() => string);
  clock?: () => number;
  fetch?: ClientOptions["fetch"];
  generateRequestId?: () => string;
  logger: Logger;
}

function resolveBaseUrl(baseUrl: string | (() => string)): string {
  return typeof baseUrl === "function" ? baseUrl() : baseUrl;
}

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

function getCookieAttributeName(attribute: string): string {
  return attribute.split("=", 1)[0]?.trim().toLowerCase() ?? "";
}

function normalizeAccessTokenSetCookie(
  value: string,
  secure: boolean,
): string | undefined {
  const [cookie, ...attributes] = value
    .split(";")
    .map((segment) => segment.trim());

  if (!cookie?.startsWith(`${ACCESS_TOKEN_COOKIE_NAME}=`)) {
    return undefined;
  }

  const forwardedAttributes = attributes.filter(
    (attribute) =>
      !MANAGED_ACCESS_TOKEN_ATTRIBUTES.has(getCookieAttributeName(attribute)),
  );
  const securityAttributes = [
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
    "Path=/",
  ];

  return [cookie, ...forwardedAttributes, ...securityAttributes].join("; ");
}

function copyAccessTokenSetCookie(
  source: Headers,
  target: Headers,
  secure: boolean,
): void {
  for (const value of source.getSetCookie()) {
    const normalizedCookie = normalizeAccessTokenSetCookie(value, secure);

    if (normalizedCookie) {
      target.append("set-cookie", normalizedCookie);
    }
  }
}

function enforceAuthenticatedResponsePrivacy(
  request: Request,
  responseHeaders: Headers,
): void {
  const accessToken = findAccessTokenCookie(request.headers.get("cookie"));

  if (!accessToken) {
    return;
  }

  responseHeaders.set("cache-control", "private, no-store");
  responseHeaders.delete("expires");
}

function findAccessTokenCookie(
  cookieHeader: string | null,
): string | undefined {
  return cookieHeader
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${ACCESS_TOKEN_COOKIE_NAME}=`));
}

function createUpstreamUrl(
  baseUrl: string,
  path: readonly string[],
  requestUrl: string,
): URL {
  const encodedPath = path
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const upstreamUrl = new URL(`/${encodedPath}`, baseUrl);
  upstreamUrl.search = new URL(requestUrl).search;
  return upstreamUrl;
}

function createUpstreamHeaders(request: Request, requestId: string): Headers {
  const headers = copyHeaders(request.headers, REQUEST_HEADERS);
  const accessToken = findAccessTokenCookie(request.headers.get("cookie"));

  headers.set("x-request-id", requestId);

  if (accessToken) {
    headers.set("cookie", accessToken);
  }

  return headers;
}

function createUpstreamRequest(
  request: Request,
  requestId: string,
  url: URL,
): Request {
  const requestInit: StreamingRequestInit = {
    body: request.body,
    duplex: "half",
    headers: createUpstreamHeaders(request, requestId),
    method: request.method,
    redirect: "manual",
    signal: request.signal,
  };

  return new Request(url, requestInit);
}

function isCrossOriginUnsafeRequest(request: Request): boolean {
  return (
    !SAFE_METHODS.has(request.method) &&
    request.headers.get("origin") !== new URL(request.url).origin
  );
}

function createCrossOriginRejection(requestId: string): Response {
  return Response.json(
    {
      error: {
        code: "FORBIDDEN",
        message: "Cross-origin request rejected.",
      },
    },
    {
      headers: { "x-request-id": requestId },
      status: 403,
    },
  );
}

function getErrorName(reason: unknown): string {
  return reason instanceof Error ? reason.name : "UnknownError";
}

function createUnavailableResponse(requestId: string): Response {
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "API is unavailable.",
      },
    },
    {
      headers: { "x-request-id": requestId },
      status: 502,
    },
  );
}

export function createApiProxy(options: ApiProxyOptions) {
  const clock = options.clock ?? Date.now;
  const fetchUpstream = options.fetch ?? ((request: Request) => fetch(request));
  const generateRequestId =
    options.generateRequestId ?? (() => globalThis.crypto.randomUUID());

  return async (request: Request, context: ApiProxyContext) => {
    const startedAt = clock();
    const requestId = generateRequestId();
    const { path } = await context.params;
    const route = `/${path.join("/")}`;

    if (isCrossOriginUnsafeRequest(request)) {
      options.logger.warn("api.proxy.rejected", {
        durationMs: Math.max(0, clock() - startedAt),
        errorCode: "cross_origin",
        method: request.method,
        requestId,
        route,
        status: 403,
      });

      return createCrossOriginRejection(requestId);
    }

    try {
      const upstreamRequest = createUpstreamRequest(
        request,
        requestId,
        createUpstreamUrl(resolveBaseUrl(options.baseUrl), path, request.url),
      );
      const upstreamResponse = await fetchUpstream(upstreamRequest);
      const responseHeaders = copyHeaders(
        upstreamResponse.headers,
        RESPONSE_HEADERS,
      );

      enforceAuthenticatedResponsePrivacy(request, responseHeaders);
      copyAccessTokenSetCookie(
        upstreamResponse.headers,
        responseHeaders,
        new URL(request.url).protocol === "https:",
      );
      responseHeaders.set("x-request-id", requestId);
      options.logger.info("api.proxy.completed", {
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
        durationMs: Math.max(0, clock() - startedAt),
        errorName: getErrorName(reason),
        method: request.method,
        requestId,
        route,
        status: 502,
      });

      return createUnavailableResponse(requestId);
    }
  };
}
