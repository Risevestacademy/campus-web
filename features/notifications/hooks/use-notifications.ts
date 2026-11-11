import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useStore } from "zustand";

import { browserApi } from "@/core/api/client/browser";
import { presenceFor } from "@/core/presence";

import {
  markAllNotificationsRead,
  markNotificationRead,
  readNotificationPage,
  readUnreadCount,
} from "../services/notification-api.adapter";

const NOTIFICATIONS = "notifications";

// The record is campus-api's list; world only nudges that a new one was
// written, and may miss one. Each nudge is part of the query key, so the list
// and the count are read again as it arrives, and the old ones stay on screen
// until the new ones land.
function useNudges(cohortId: string): number {
  return useStore(presenceFor(cohortId), (state) => state.notificationsVersion);
}

export function useNotificationList(cohortId: string) {
  const nudges = useNudges(cohortId);

  return useInfiniteQuery({
    queryKey: [NOTIFICATIONS, "list", nudges],
    queryFn: async ({ pageParam }) => {
      const read = await readNotificationPage(browserApi, { page: pageParam });
      if (read.kind === "unavailable")
        throw new Error("Notifications unavailable");
      return read;
    },
    initialPageParam: 1,
    getNextPageParam: ({ page, totalPages }) =>
      page < totalPages ? page + 1 : undefined,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

// Zero until it is known: a badge is never shown for a count nobody checked.
export function useUnreadNotificationCount(cohortId: string): number {
  const nudges = useNudges(cohortId);
  const query = useQuery({
    queryKey: [NOTIFICATIONS, "unread", nudges],
    queryFn: async () => {
      const count = await readUnreadCount(browserApi);
      if (count === undefined) throw new Error("Notifications unavailable");
      return count;
    },
    placeholderData: keepPreviousData,
    retry: false,
  });

  return query.data ?? 0;
}

function useMarking<Variables>(
  mark: (variables: Variables) => ReturnType<typeof markAllNotificationsRead>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mark,
    retry: false,
    // Whatever the outcome, read again: a notification another tab read, or
    // one gone, should not stay on screen as it was.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS] }),
  });
}

export function useMarkNotificationRead() {
  return useMarking((id: string) => markNotificationRead(browserApi, id));
}

export function useMarkAllNotificationsRead() {
  return useMarking(() => markAllNotificationsRead(browserApi));
}
