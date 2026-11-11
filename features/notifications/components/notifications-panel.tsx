"use client";

import { BellSlashIcon } from "@phosphor-icons/react/dist/ssr/BellSlash";
import { ChecksIcon } from "@phosphor-icons/react/dist/ssr/Checks";
import { type ReactNode, useState } from "react";
import { useStore } from "zustand";

import { describeNotification } from "@/core/notifications";
import { presenceFor, spaceNameOf } from "@/core/presence";
import { Button } from "@/shared/ui/button";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadNotificationCount,
} from "../hooks/use-notifications";
import { NotificationRow } from "./notification-row";

interface NotificationsPanelProps {
  cohortId: string;
  collapseButton: ReactNode;
}

function PanelMessage({
  action,
  children,
}: {
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="bg-surface text-icon-muted grid size-12 place-items-center rounded-xl">
        <BellSlashIcon aria-hidden size={22} weight="regular" />
      </div>
      <p className="text-foreground-secondary text-sm text-pretty">
        {children}
      </p>
      {action}
    </div>
  );
}

export function NotificationsPanel({
  cohortId,
  collapseButton,
}: NotificationsPanelProps) {
  const spaceNames = useStore(
    presenceFor(cohortId),
    (state) => state.spaceNames,
  );
  const list = useNotificationList(cohortId);
  const unread = useUnreadNotificationCount(cohortId);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  // Read once per mount: "3 minutes ago" is as fresh as the panel is open.
  const [now] = useState(() => Date.now());

  const notifications =
    list.data?.pages.flatMap((page) => page.notifications) ?? [];

  // A notification may be about another cohort's space, whose names this
  // cohort's snapshot does not carry.
  const spaceName = ({
    cohortId: from,
    spaceKey,
  }: {
    cohortId: string;
    spaceKey: string;
  }) =>
    from === cohortId
      ? spaceNameOf({ spaceNames }, spaceKey)
      : "a space in another cohort";

  let body: ReactNode;
  if (list.isError && notifications.length === 0) {
    body = (
      <PanelMessage
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void list.refetch()}
          >
            Try again
          </Button>
        }
      >
        We couldn&apos;t load your notifications.
      </PanelMessage>
    );
  } else if (list.isPending) {
    body = <PanelMessage>Loading your notifications…</PanelMessage>;
  } else if (notifications.length === 0) {
    body = (
      <PanelMessage>
        Nothing yet. New notices and answers to your requests to enter a space
        show up here.
      </PanelMessage>
    );
  } else {
    body = (
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul>
          {notifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              createdAt={notification.createdAt}
              isMarking={
                markRead.isPending && markRead.variables === notification.id
              }
              kind={notification.kind}
              now={now}
              onRead={() => markRead.mutate(notification.id)}
              read={notification.read}
              text={describeNotification(notification, spaceName)}
            />
          ))}
        </ul>
        {list.hasNextPage ? (
          <div className="p-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              {list.isFetchingNextPage ? "Loading…" : "Show older"}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-foreground text-xl font-semibold">
              Notifications
            </h2>
            <p className="text-foreground-secondary mt-1 text-sm">
              {unread === 0 ? "You're all caught up." : `${unread} unread`}
            </p>
          </div>
          {collapseButton}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={unread === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          <ChecksIcon aria-hidden data-icon="inline-start" />
          Mark all as read
        </Button>
      </div>
      {body}
    </div>
  );
}
