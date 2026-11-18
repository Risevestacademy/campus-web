import { useMutation } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useMountEffect } from "@/shared/lib/use-mount-effect";

import { refreshSession } from "../services/browser-session";
import { cooldownAfter } from "../services/refresh-cooldown";
import { signInHref } from "../services/route-policy";
import type { SessionRefresh } from "../services/session.service";

type SessionRefreshState =
  | { status: "pending"; failures: number }
  | { status: "failed"; failures: number; cooldownMs: number };

let latestAttempt = 0;

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
