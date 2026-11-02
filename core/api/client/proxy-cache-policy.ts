import { hasSessionCookie } from "./proxy-cookie-policy";

const AUTH_ROUTE_PREFIX = "/v1/auth/";

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

export function forbidCaching(responseHeaders: Headers): void {
  responseHeaders.set("cache-control", "private, no-store");
  responseHeaders.delete("expires");
}

export function applyPrivateCachePolicy(
  route: string,
  request: Request,
  responseHeaders: Headers,
): void {
  if (isPrivateResponse(route, request, responseHeaders)) {
    forbidCaching(responseHeaders);
  }
}
