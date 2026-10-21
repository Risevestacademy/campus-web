import "server-only";

import type { ClientOptions } from "openapi-fetch";

import type { Logger } from "@/core/observability";

import { REFRESH_ATTEMPTED_COOKIE, SESSION_COOKIE } from "./auth-cookies";
import { CLIENT_ADDRESS_HEADER, readClientAddress } from "./client-address";
import type { components } from "./generated/schema";
import { isPublishedRoute } from "./upstream-routes";

type ExceptionCode = components["schemas"]["ExceptionCode"];

const AUTH_COOKIE_NAMES = new Set([
  "campus_oauth_state",
  "campus_refresh",
  SESSION_COOKIE,
]);
const OAUTH_RETURN_COOKIE_NAME = "campus_oauth_return_to";
const OAUTH_RETURN_COOKIE_PATH = "/api/v1/auth";
const OAUTH_RETURN_MAX_AGE_SECONDS = 600;
const AUTH_ROUTE_PREFIX = "/v1/auth/";
const GOOGLE_AUTH_ROUTE = "/v1/auth/google";
const GOOGLE_CALLBACK_ROUTE = "/v1/auth/google/callback";
const REFRESH_ROUTE = "/v1/auth/refresh";
const REFRESH_ATTEMPTED_PATH = "/";
const REFRESH_ATTEMPTED_MAX_AGE_SECONDS = 60;
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

const MANAGED_COOKIE_ATTRIBUTES = new Set([
  "domain",
  "httponly",
  "path",
  "samesite",
  "secure",
]);

type ParseReturnTo = (value: string | undefined) => string | undefined;

interface ScopedCookie {
  name: string;
  path: string;
}

interface ProxyCookie extends ScopedCookie {
  value: string;
  maxAge: number;
}

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

function readRequestedReturnTo(
  requestUrl: string,
  parseReturnTo: ParseReturnTo,
): string | undefined {
  return parseReturnTo(
    new URL(requestUrl).searchParams.get("returnTo") ?? undefined,
  );
}

function readStoredReturnTo(
  request: Request,
  parseReturnTo: ParseReturnTo,
): string | undefined {
  return parseReturnTo(
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
    cookieName === SESSION_COOKIE
      ? attributes.find(
          (attribute) => getCookieAttributeName(attribute) === "domain",
        )
      : undefined;
  const securityAttributes = [
    ...(domainAttribute ? [domainAttribute] : []),
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
    cookieName === SESSION_COOKIE
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

function serializeProxyCookie(cookie: ProxyCookie, secure: boolean): string {
  return [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
    `Path=${cookie.path}`,
    `Max-Age=${cookie.maxAge}`,
  ].join("; ");
}

function appendReturnCookie(
  headers: Headers,
  returnTo: string | undefined,
  secure: boolean,
): void {
  headers.append(
    "set-cookie",
    serializeProxyCookie(
      {
        name: OAUTH_RETURN_COOKIE_NAME,
        value: returnTo ?? "",
        path: OAUTH_RETURN_COOKIE_PATH,
        maxAge: returnTo ? OAUTH_RETURN_MAX_AGE_SECONDS : 0,
      },
      secure,
    ),
  );
}

function appendRefreshAttemptedCookie(headers: Headers, secure: boolean): void {
  headers.append(
    "set-cookie",
    serializeProxyCookie(
      {
        name: REFRESH_ATTEMPTED_COOKIE,
        value: "1",
        path: REFRESH_ATTEMPTED_PATH,
        maxAge: REFRESH_ATTEMPTED_MAX_AGE_SECONDS,
      },
      secure,
    ),
  );
}

// An empty value is the backend clearing a host-only session before setting
// the domain one, not a sign-in.
function startsSession(upstreamHeaders: Headers): boolean {
  return upstreamHeaders
    .getSetCookie()
    .some((setCookie) => Boolean(findCookieValue(setCookie, SESSION_COOKIE)));
}

function expireCookies(
  headers: Headers,
  cookies: readonly ScopedCookie[],
  secure: boolean,
): void {
  for (const { name, path } of cookies) {
    headers.append(
      "set-cookie",
      serializeProxyCookie({ name, value: "", path, maxAge: 0 }, secure),
    );
  }
}

function hasSessionCookie(request: Request): boolean {
  return (
    findCookies(request.headers.get("cookie"), new Set([SESSION_COOKIE]))
      .length > 0
  );
}

function isPrivateResponse(route: string, request: Request): boolean {
  return route.startsWith(AUTH_ROUTE_PREFIX) || hasSessionCookie(request);
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
  const clientAddress = readClientAddress(request.headers);

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

function findRejection(
  request: Request,
  path: readonly string[],
): Rejection | undefined {
  if (!isPublishedRoute(path)) return UNKNOWN_ROUTE;
  if (isCrossOriginUnsafeRequest(request)) return CROSS_ORIGIN;
  return undefined;
}

function createErrorResponse(
  requestId: string,
  status: number,
  error: ApiError,
): Response {
  return Response.json(
    { error },
    {
      headers: { "x-request-id": requestId },
      status,
    },
  );
}

function getErrorName(reason: unknown): string {
  return reason instanceof Error ? reason.name : "UnknownError";
}

function rewriteSuccessfulOauthDestination(
  request: Request,
  responseHeaders: Headers,
  parseReturnTo: ParseReturnTo,
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

  const returnTo = readStoredReturnTo(request, parseReturnTo) ?? "/campus";
  responseHeaders.set("location", new URL(returnTo, requestUrl).href);
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
    const route = `/${path.join("/")}`;
    const secure = new URL(request.url).protocol === "https:";

    const rejection = findRejection(request, path);

    if (rejection) {
      options.logger.warn("api.proxy.rejected", {
        durationMs: Math.max(0, clock() - startedAt),
        errorCode: rejection.errorCode,
        method: request.method,
        requestId,
        route,
        status: rejection.status,
      });

      return createErrorResponse(requestId, rejection.status, rejection.error);
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

      if (isPrivateResponse(route, request)) {
        forbidCaching(responseHeaders);
      }
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

      responseHeaders.set("x-request-id", requestId);
      options.logger.info("api.proxy.completed", {
        clientAddress: upstreamRequest.headers.has(CLIENT_ADDRESS_HEADER)
          ? "forwarded"
          : "absent",
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

      const response = createErrorResponse(requestId, 502, API_UNAVAILABLE);

      if (route === GOOGLE_CALLBACK_ROUTE) {
        appendReturnCookie(response.headers, undefined, secure);
      }

      return response;
    }
  };
}
