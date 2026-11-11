import type { ApiClient } from "@/core/api/client";

import {
  type NotificationPage,
  parseNotificationPage,
} from "../schemas/notification.schema";

export const NOTIFICATIONS_PER_PAGE = 20;

export type NotificationPageRead =
  ({ kind: "loaded" } & NotificationPage) | { kind: "unavailable" };

export async function readNotificationPage(
  api: ApiClient,
  { page, unread }: { page: number; unread?: boolean },
  perPage = NOTIFICATIONS_PER_PAGE,
): Promise<NotificationPageRead> {
  try {
    const { data, response } = await api.GET("/v1/notifications", {
      params: { query: { page, perPage, ...(unread && { unread }) } },
    });
    const loaded = response.ok ? parseNotificationPage(data) : undefined;
    return loaded ? { kind: "loaded", ...loaded } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

// The badge only needs how many, so the page asked for holds one.
export async function readUnreadCount(
  api: ApiClient,
): Promise<number | undefined> {
  const read = await readNotificationPage(api, { page: 1, unread: true }, 1);
  return read.kind === "loaded" ? read.total : undefined;
}

export type NotificationMarking =
  { kind: "marked" } | { kind: "problem"; problem: "missing" | "unavailable" };

export async function markNotificationRead(
  api: ApiClient,
  id: string,
): Promise<NotificationMarking> {
  try {
    const { response } = await api.PATCH("/v1/notifications/{id}/read", {
      params: { path: { id } },
    });
    if (response.ok) return { kind: "marked" };
    return {
      kind: "problem",
      problem: response.status === 404 ? "missing" : "unavailable",
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

export async function markAllNotificationsRead(
  api: ApiClient,
): Promise<NotificationMarking> {
  try {
    const { response } = await api.POST("/v1/notifications/read-all");
    return response.ok
      ? { kind: "marked" }
      : { kind: "problem", problem: "unavailable" };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
