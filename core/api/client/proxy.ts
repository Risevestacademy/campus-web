import "server-only";

import type { ClientOptions } from "openapi-fetch";

import type { Logger } from "@/core/observability";

const AUTH_COOKIE_NAMES = new Set([
  "campus_oauth_state",
  "campus_refresh",
  "campus_session",
]);
const SESSION_COOKIE_NAME = "campus_session";
const OAUTH_RETURN_COOKIE_NAME = "campus_oauth_return_to";
const OAUTH_RETURN_COOKIE_PATH = "/api/v1/auth";
const OAUTH_RETURN_MAX_AGE_SECONDS = 600;
const GOOGLE_AUTH_ROUTE = "/v1/auth/google";
const GOOGLE_CALLBACK_ROUTE = "/v1/auth/google/callback";
const REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-unmodified-since",
  "range",
  "x-forwarded-for",
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

const MANAGED_COOKIE_ATTRIBUTES = new Set([
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

function getCookieName(cookie: string): string {
  const separatorIndex = cookie.indexOf("=");
  return separatorIndex === -1
    ? cookie.trim()
    : cookie.slice(0, separatorIndex).trim();
}

function findCookies(
  cookieHeader: string | null,
  allowedNames: ReadonlySet<string>,
): string[] {
  return (
    cookieHeader
      ?.split(";")
      .map((cookie) => cookie.trim())
      .filter((cookie) => allowedNames.has(getCookieName(cookie))) ?? []
  );
}

function findCookieValue(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  const cookie = findCookies(cookieHeader, new Set([name]))[0];
  if (!cookie) return undefined;

  const value = cookie.slice(cookie.indexOf("=") + 1);

  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function normalizeJoinReturnTo(value: string | undefined): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }

  const match = /^\/campus\/([^/?#]+)\/join$/u.exec(value);
  if (!match?.[1]) return undefined;

  try {
    const campusId = decodeURIComponent(match[1]);

    if (
      !campusId ||
      campusId === "." ||
      campusId === ".." ||
      campusId.includes("/")
    ) {
      return undefined;
    }

    return `/campus/${encodeURIComponent(campusId)}/join`;
  } catch {
    return undefined;
  }
}

function readRequestedReturnTo(requestUrl: string): string | undefined {
  return normalizeJoinReturnTo(
    new URL(requestUrl).searchParams.get("returnTo") ?? undefined,
  );
}

function readStoredReturnTo(request: Request): string | undefined {
  return normalizeJoinReturnTo(
    findCookieValue(request.headers.get("cookie"), OAUTH_RETURN_COOKIE_NAME),
  );
}

function normalizeAuthSetCookie(
  value: string,
  secure: boolean,
): string | undefined {
  const [cookie, ...attributes] = value
    .split(";")
    .map((segment) => segment.trim());

  if (!cookie) return undefined;

  const cookieName = getCookieName(cookie);
  if (!AUTH_COOKIE_NAMES.has(cookieName)) return undefined;

  const forwardedAttributes = attributes.filter(
    (attribute) =>
      !MANAGED_COOKIE_ATTRIBUTES.has(getCookieAttributeName(attribute)),
  );
  const domainAttribute =
    cookieName === SESSION_COOKIE_NAME
      ? attributes.find(
          (attribute) => getCookieAttributeName(attribute) === "domain",
        )
      : undefined;
  const securityAttributes = [
    ...(domainAttribute ? [domainAttribute] : []),
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
    cookieName === SESSION_COOKIE_NAME
      ? "Path=/"
      : `Path=${OAUTH_RETURN_COOKIE_PATH}`,
  ];

  return [cookie, ...forwardedAttributes, ...securityAttributes].join("; ");
}

function copyAuthSetCookies(
  source: Headers,
  target: Headers,
  secure: boolean,
): void {
  for (const value of source.getSetCookie()) {
    const normalizedCookie = normalizeAuthSetCookie(value, secure);

    if (normalizedCookie) {
      target.append("set-cookie", normalizedCookie);
    }
  }
}

function serializeReturnCookie(
  value: string,
  secure: boolean,
  maxAge: number,
): string {
  return [
    `${OAUTH_RETURN_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
    `Path=${OAUTH_RETURN_COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
  ].join("; ");
}

function appendReturnCookie(
  headers: Headers,
  returnTo: string | undefined,
  secure: boolean,
): void {
  headers.append(
    "set-cookie",
    serializeReturnCookie(
      returnTo ?? "",
      secure,
      returnTo ? OAUTH_RETURN_MAX_AGE_SECONDS : 0,
    ),
  );
}

function enforceAuthenticatedResponsePrivacy(
  request: Request,
  responseHeaders: Headers,
): void {
  const sessionCookie = findCookies(
    request.headers.get("cookie"),
    new Set([SESSION_COOKIE_NAME]),
  )[0];

  if (!sessionCookie) return;

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

  if (route === GOOGLE_AUTH_ROUTE) {
    upstreamUrl.searchParams.delete("returnTo");
  }

  return upstreamUrl;
}

function createUpstreamHeaders(request: Request, requestId: string): Headers {
  const headers = copyHeaders(request.headers, REQUEST_HEADERS);
  const authCookies = findCookies(
    request.headers.get("cookie"),
    AUTH_COOKIE_NAMES,
  );

  headers.set("x-request-id", requestId);

  if (authCookies.length > 0) {
    headers.set("cookie", authCookies.join("; "));
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
  if (SAFE_METHODS.has(request.method)) return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (!forwardedHost || !forwardedProto) return true;

  const requestOrigin = `${forwardedProto}://${forwardedHost}`;

  return origin !== requestOrigin;
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

function rewriteSuccessfulOauthDestination(
  request: Request,
  responseHeaders: Headers,
): void {
  const location = responseHeaders.get("location");
  if (!location) return;

  const requestUrl = new URL(request.url);
  const destination = new URL(location, requestUrl);
  const isFrontendRoot =
    destination.origin === requestUrl.origin &&
    destination.pathname === "/" &&
    destination.search === "" &&
    destination.hash === "";

  if (!isFrontendRoot) return;

  const returnTo = readStoredReturnTo(request) ?? "/campus";
  responseHeaders.set("location", new URL(returnTo, requestUrl).href);
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
    const secure = new URL(request.url).protocol === "https:";

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

      enforceAuthenticatedResponsePrivacy(request, responseHeaders);
      copyAuthSetCookies(upstreamResponse.headers, responseHeaders, secure);

      if (route === GOOGLE_AUTH_ROUTE) {
        appendReturnCookie(
          responseHeaders,
          readRequestedReturnTo(request.url),
          secure,
        );
      }

      if (route === GOOGLE_CALLBACK_ROUTE) {
        rewriteSuccessfulOauthDestination(request, responseHeaders);
        appendReturnCookie(responseHeaders, undefined, secure);
      }

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

      const response = createUnavailableResponse(requestId);

      if (route === GOOGLE_CALLBACK_ROUTE) {
        appendReturnCookie(response.headers, undefined, secure);
      }

      return response;
    }
  };
}
