import "server-only";

import { cookies } from "next/headers";
import type { ClientOptions } from "openapi-fetch";

import { readApiBaseUrl } from "./configuration";
import { createApiClient } from "./create-api-client";

const ACCESS_TOKEN_COOKIE_NAME = "accessToken";

interface ServerApiOptions {
  authentication?: "cookie" | "none";
  fetch?: ClientOptions["fetch"];
}

function serializeAccessTokenCookie(value: string): string {
  return `${ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(value)}`;
}

export async function getServerApi(options: ServerApiOptions = {}) {
  const accessToken =
    options.authentication === "none"
      ? undefined
      : (await cookies()).get(ACCESS_TOKEN_COOKIE_NAME);
  const headers = accessToken
    ? { cookie: serializeAccessTokenCookie(accessToken.value) }
    : undefined;

  return createApiClient({
    baseUrl: readApiBaseUrl(),
    fetch: options.fetch,
    headers,
  });
}
