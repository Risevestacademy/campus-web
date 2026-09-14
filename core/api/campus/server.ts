import "server-only";

import { cookies } from "next/headers";
import type { ClientOptions } from "openapi-fetch";

import { readCampusApiBaseUrl } from "./configuration";
import { createCampusApi } from "./create-campus-api";

const ACCESS_TOKEN_COOKIE_NAME = "accessToken";

interface CampusServerApiOptions {
  authentication?: "cookie" | "none";
  fetch?: ClientOptions["fetch"];
}

function serializeAccessTokenCookie(value: string): string {
  return `${ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(value)}`;
}

export async function getCampusServerApi(options: CampusServerApiOptions = {}) {
  const accessToken =
    options.authentication === "none"
      ? undefined
      : (await cookies()).get(ACCESS_TOKEN_COOKIE_NAME);
  const headers = accessToken
    ? { cookie: serializeAccessTokenCookie(accessToken.value) }
    : undefined;

  return createCampusApi({
    baseUrl: readCampusApiBaseUrl(),
    fetch: options.fetch,
    headers,
  });
}
