import { useMutation, useQueryClient } from "@tanstack/react-query";

import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { disconnectCalendar } from "../services/calendar-api.adapter";
import { CALENDAR_EVENTS_KEY } from "./use-calendar-events";

export function useDisconnectCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => disconnectCalendar(browserApi),
    retry: false,
    onSuccess(outcome) {
      if (outcome === "disconnected") {
        queryClient.setQueriesData(
          { queryKey: CALENDAR_EVENTS_KEY },
          { kind: "not-connected", by: "member" },
        );
        toast.add({ title: "Google Calendar disconnected.", type: "success" });
        return;
      }
      toast.add({
        title:
          outcome === "signed-out"
            ? "Your session ran out. Sign in and try again."
            : "We couldn't disconnect your calendar. Try again.",
        type: "warning",
      });
    },
  });
}
