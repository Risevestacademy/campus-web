import "server-only";

import { cookies, headers } from "next/headers";
import type { ClientOptions } from "openapi-fetch";

import { SESSION_COOKIE } from "./auth-cookies";
import { readApiBaseUrl } from "./configuration";
import { createApiClient } from "./create-api-client";

const CLIENT_ADDRESS_HEADER = "x-forwarded-for";

interface ServerApiOptions {
  authentication?: "cookie" | "none";
  fetch?: ClientOptions["fetch"];
}

function serializeSessionCookie(value: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}`;
}

// campus-api rate-limits by client address. Without the visitor's
// X-Forwarded-For every server read would count against the Next server's IP.
async function readVisitorHeaders(): Promise<Record<string, string>> {
  const [requestCookies, requestHeaders] = await Promise.all([
    cookies(),
    headers(),
  ]);
  const session = requestCookies.get(SESSION_COOKIE);
  const clientAddress = requestHeaders.get(CLIENT_ADDRESS_HEADER);

  return {
    ...(session && { cookie: serializeSessionCookie(session.value) }),
    ...(clientAddress && { [CLIENT_ADDRESS_HEADER]: clientAddress }),
  };
}

export async function getServerApi(options: ServerApiOptions = {}) {
  const visitorHeaders =
    options.authentication === "none" ? undefined : await readVisitorHeaders();

  return createApiClient({
    baseUrl: readApiBaseUrl(),
    fetch: options.fetch,
    headers: visitorHeaders,
  });
}
