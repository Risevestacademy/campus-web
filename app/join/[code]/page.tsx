import { notFound, redirect } from "next/navigation";

import { getServerApi } from "@/core/api/client/server";
import { campusHref, campusPreJoinHref } from "@/core/navigation";
import { requireRouteAccess, SessionUnavailable } from "@/features/auth";
import {
  enterRoomLink,
  parseRoomLinkCode,
  RoomLinkNotice,
} from "@/features/room-link";

interface RoomLinkPageProps {
  params: Promise<{ code: string }>;
}

export default async function RoomLinkPage({ params }: RoomLinkPageProps) {
  const code = parseRoomLinkCode((await params).code);
  if (!code) notFound();

  const access = await requireRouteAccess({ kind: "room-link" });
  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  const entry = await enterRoomLink(await getServerApi(), code);
  if (entry.kind === "entered") {
    const map = `${campusHref(entry.cohortId)}?${new URLSearchParams({
      goToSpace: entry.spaceKey,
    })}`;
    redirect(campusPreJoinHref(entry.cohortId, map));
  }

  return <RoomLinkNotice kind={entry.kind} retryHref={`/join/${code}`} />;
}
