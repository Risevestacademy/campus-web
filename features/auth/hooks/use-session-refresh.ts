import { useMutation } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { browserApi } from "@/core/api/client/browser";

import {
  createSessionRefresher,
  type SessionRefresh,
} from "../services/session.service";
import { useMountEffect } from "./use-mount-effect";

type SessionRefreshState =
  | { status: "pending"; failures: number }
  | { status: "failed"; failures: number; cooldownMs: number };

const COOLDOWN_SCHEDULE_MS = [1000, 2000, 4000, 8000] as const;
const MAX_COOLDOWN_MS = 8000;

function cooldownAfter(failures: number, retryAfterMs = 0): number {
  const scheduledMs = COOLDOWN_SCHEDULE_MS[
    Math.min(failures, COOLDOWN_SCHEDULE_MS.length) - 1
  ] as number;
  return Math.max(scheduledMs, Math.min(retryAfterMs, MAX_COOLDOWN_MS));
}

function signInHref(returnTo: string): Route {
  const search = new URLSearchParams({ returnTo });
  return `/sign-in?${search.toString()}` as Route;
}

export function useSessionRefresh(returnTo: string) {
  const router = useRouter();
  // One refresher per mounted page: StrictMode's double mount shares it, and
  // no request state outlives the page.
  const [refreshSession] = useState(() => createSessionRefresher(browserApi));
  const [state, setState] = useState<SessionRefreshState>({
    status: "pending",
    failures: 0,
  });

  function settle(outcome: SessionRefresh, previousFailures: number) {
    switch (outcome.kind) {
      case "refreshed":
        router.replace(returnTo as Route);
        return;
      case "expired":
        router.replace(signInHref(returnTo));
        return;
      case "failed":
        setState({
          status: "failed",
          failures: previousFailures + 1,
          cooldownMs: cooldownAfter(previousFailures + 1, outcome.retryAfterMs),
        });
    }
  }

  // The rotating refresh POST must never be replayed automatically.
  const refresh = useMutation({ mutationFn: refreshSession, retry: false });

  // Per-call callbacks fire only for the latest mutate(), so StrictMode's
  // second mount supersedes the first without a manual cancellation flag.
  function attempt(previousFailures: number) {
    refresh.mutate(undefined, {
      onSuccess: (outcome) => settle(outcome, previousFailures),
    });
  }

  useMountEffect(() => attempt(0));

  function retry() {
    const { failures } = state;
    setState({ status: "pending", failures });
    attempt(failures);
  }

  return { state, retry };
}
