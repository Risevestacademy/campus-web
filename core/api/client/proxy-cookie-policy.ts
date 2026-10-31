import { REFRESH_ATTEMPTED_COOKIE, SESSION_COOKIE } from "./auth-cookies";

export const AUTH_COOKIE_PATH = "/api/v1/auth";

const AUTH_COOKIE_NAMES = new Set([
  "campus_oauth_state",
  "campus_refresh",
  SESSION_COOKIE,
]);
const MANAGED_COOKIE_ATTRIBUTES = new Set([
  "domain",
  "httponly",
  "path",
  "samesite",
  "secure",
]);
const REFRESH_ATTEMPTED_PATH = "/";
const REFRESH_ATTEMPTED_MAX_AGE_SECONDS = 60;

export interface ScopedCookie {
  name: string;
  path: string;
}

export interface ProxyCookie extends ScopedCookie {
  value: string;
  maxAge: number;
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

export function findAuthCookies(cookieHeader: string | null): string[] {
  return findCookies(cookieHeader, AUTH_COOKIE_NAMES);
}

export function findCookieValue(
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

export function hasSessionCookie(request: Request): boolean {
  return (
    findCookies(request.headers.get("cookie"), new Set([SESSION_COOKIE]))
      .length > 0
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
    cookieName === SESSION_COOKIE ? "Path=/" : `Path=${AUTH_COOKIE_PATH}`,
  ];

  return [cookie, ...forwardedAttributes, ...securityAttributes].join("; ");
}

export function copyAuthSetCookies(
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

export function serializeProxyCookie(
  cookie: ProxyCookie,
  secure: boolean,
): string {
  return [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
    `Path=${cookie.path}`,
    `Max-Age=${cookie.maxAge}`,
  ].join("; ");
}

export function appendRefreshAttemptedCookie(
  headers: Headers,
  secure: boolean,
): void {
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
export function startsSession(upstreamHeaders: Headers): boolean {
  return upstreamHeaders
    .getSetCookie()
    .some((setCookie) => Boolean(findCookieValue(setCookie, SESSION_COOKIE)));
}

export function expireCookies(
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
