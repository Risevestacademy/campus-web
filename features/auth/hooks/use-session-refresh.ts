import { useMutation } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { browserApi } from "@/core/api/client/browser";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

import {
  createSessionRefresher,
  type SessionRefresh,
} from "../services/session.service";

type SessionRefreshState =
  | { status: "pending"; failures: number }
  | { status: "failed"; failures: number; cooldownMs: number };

const COOLDOWN_SCHEDULE_MS = [1000, 2000, 4000, 8000] as const;
const MAX_COOLDOWN_MS = 8000;
// A soft route transition can remount the refresh page while its rotating-token
// request is in flight. The replacement mount must join that same request.
const refreshSession = createSessionRefresher(browserApi);
let latestAttempt = 0;

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
  const [state, setState] = useState<SessionRefreshState>({
    status: "pending",
    failures: 0,
  });

  function replaceAfterRedirect(href: Route) {
    // A proxy redirect can leave the App Router keyed to the requested URL
    // instead of the visible refresh URL, making a return to that request a
    // no-op. Native history calls are integrated with the App Router; refresh
    // then loads the server tree for the replaced URL.
    window.history.replaceState(null, "", href);
    router.refresh();
  }

  function settle(outcome: SessionRefresh, previousFailures: number) {
    switch (outcome.kind) {
      case "refreshed":
        replaceAfterRedirect(returnTo as Route);
        return;
      case "expired":
        replaceAfterRedirect(signInHref(returnTo));
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

  function attempt(previousFailures: number) {
    const attemptId = ++latestAttempt;
    void refresh.mutateAsync().then((outcome) => {
      if (attemptId === latestAttempt) settle(outcome, previousFailures);
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
