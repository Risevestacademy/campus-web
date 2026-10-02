import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { getServerApi } from "@/core/api/client/server";

import type {
  RouteAuthorizationDecision,
  RouteAuthorizationRequest,
} from "../types/auth.types";
import {
  REFRESH_ATTEMPTED_HEADER,
  RETURN_TO_HEADER,
} from "./campus-request-headers";
import { type CampusRequestSignals, decideRoute } from "./route-policy";
import { readSession } from "./session.service";

// Argument-free so React memoizes one backend read per server request, however
// many layouts and pages ask.
const readRequestSession = cache(async () => readSession(await getServerApi()));

async function readCampusRequestSignals(): Promise<CampusRequestSignals> {
  const requestHeaders = await headers();
  return {
    returnTo: requestHeaders.get(RETURN_TO_HEADER) ?? undefined,
    refreshAttempted: requestHeaders.has(REFRESH_ATTEMPTED_HEADER),
  };
}

export async function authorizeRoute(
  request: RouteAuthorizationRequest,
): Promise<RouteAuthorizationDecision> {
  const [sessionRead, signals] = await Promise.all([
    readRequestSession(),
    readCampusRequestSignals(),
  ]);

  return decideRoute(request, sessionRead, signals);
}
