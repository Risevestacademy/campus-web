import {
  AUTH_COOKIE_PATH,
  findCookieValue,
  serializeProxyCookie,
} from "./proxy-cookie-policy";

const OAUTH_RETURN_COOKIE_NAME = "campus_oauth_return_to";
const OAUTH_RETURN_MAX_AGE_SECONDS = 600;
const RETURN_TO_PARAM = "returnTo";
const CAMPUS_HOME_PATH = "/campus";

export type ParseReturnTo = (value: string | undefined) => string | undefined;

export function removeRequestedReturnTo(upstreamUrl: URL): void {
  upstreamUrl.searchParams.delete(RETURN_TO_PARAM);
}

export function readRequestedReturnTo(
  requestUrl: string,
  parseReturnTo: ParseReturnTo,
): string | undefined {
  return parseReturnTo(
    new URL(requestUrl).searchParams.get(RETURN_TO_PARAM) ?? undefined,
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

export function appendReturnCookie(
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
        path: AUTH_COOKIE_PATH,
        maxAge: returnTo ? OAUTH_RETURN_MAX_AGE_SECONDS : 0,
      },
      secure,
    ),
  );
}

export function rewriteSuccessfulOauthDestination(
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

  const returnTo =
    readStoredReturnTo(request, parseReturnTo) ?? CAMPUS_HOME_PATH;
  responseHeaders.set("location", new URL(returnTo, requestUrl).href);
}
