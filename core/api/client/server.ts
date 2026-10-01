import "server-only";

import { cookies } from "next/headers";
import type { ClientOptions } from "openapi-fetch";

import { readApiBaseUrl } from "./configuration";
import { createApiClient } from "./create-api-client";

const SESSION_COOKIE_NAME = "campus_session";

interface ServerApiOptions {
  authentication?: "cookie" | "none";
  fetch?: ClientOptions["fetch"];
}

function serializeSessionCookie(value: string): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`;
}

export async function getServerApi(options: ServerApiOptions = {}) {
  const session =
    options.authentication === "none"
      ? undefined
      : (await cookies()).get(SESSION_COOKIE_NAME);
  const headers = session
    ? { cookie: serializeSessionCookie(session.value) }
    : undefined;

  return createApiClient({
    baseUrl: readApiBaseUrl(),
    fetch: options.fetch,
    headers,
  });
}
