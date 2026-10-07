import { useMutation } from "@tanstack/react-query";

import { ANALYTICS_EVENTS } from "@/core/analytics";
import {
  captureBrowserAnalyticsEvent,
  resetAnalyticsUser,
} from "@/core/analytics/client";
import { browserApi } from "@/core/api/client/browser";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { toast } from "@/shared/ui/toast";

import { clearCampusEntrySession } from "../services/campus-entry-session.client";
import { endSession, type SessionEnd } from "../services/session.service";

const SIGN_IN_PATH = "/sign-in";

function leaveCampus() {
  captureBrowserAnalyticsEvent(ANALYTICS_EVENTS.AUTH_LOGOUT, {
    logout_source: "user_action",
  });
  resetAnalyticsUser();
  clearCampusEntrySession();
  replaceDocument(SIGN_IN_PATH);
}

function explainFailure() {
  toast.add({
    title: "We couldn't log you out",
    description:
      "You are still signed in. Check your connection and try again.",
    type: "error",
  });
}

function settle(outcome: SessionEnd) {
  if (outcome.kind === "ended") leaveCampus();
  else explainFailure();
}

export function useLogOut() {
  // Logging out revokes the refresh token, so it is never replayed for us.
  const logout = useMutation({
    mutationFn: () => endSession(browserApi),
    retry: false,
    onSuccess: settle,
  });

  return { logOut: () => logout.mutate(), isPending: logout.isPending };
}
