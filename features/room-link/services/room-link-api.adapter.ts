import type { ApiClient } from "@/core/api/client";

import {
  parseRoomLinkEntry,
  type RoomLinkEntry,
} from "../schemas/room-link.schema";

export type RoomLinkEntryRead =
  | ({ kind: "entered" } & RoomLinkEntry)
  // Revoked, never set up, or not the caller's: campus-api says the same to
  // each, so the page does too.
  | { kind: "unusable" }
  | { kind: "unavailable" };

export async function enterRoomLink(
  api: ApiClient,
  code: string,
): Promise<RoomLinkEntryRead> {
  try {
    const { data, response } = await api.POST("/v1/room-links/{code}/enter", {
      params: { path: { code } },
    });
    if (response.status === 400 || response.status === 404) {
      return { kind: "unusable" };
    }

    const entry = response.ok ? parseRoomLinkEntry(data) : undefined;
    return entry ? { kind: "entered", ...entry } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
