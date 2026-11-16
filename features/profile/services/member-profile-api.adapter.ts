import type { ApiClient } from "@/core/api/client";

import { parseMemberProfile } from "../schemas/member-profile.schema";
import type { MemberProfileRead } from "../types";

export async function readMemberProfile(
  api: ApiClient,
  userId: string,
): Promise<MemberProfileRead> {
  try {
    const { data, response } = await api.GET("/v1/users/{id}/profile", {
      params: { path: { id: userId } },
    });
    if (response.status === 401) return { kind: "signed-out" };
    // 400 is an id that is not a UUID: no card can be under it either.
    if (response.status === 404 || response.status === 400) {
      return { kind: "missing" };
    }
    const profile = response.ok ? parseMemberProfile(data) : undefined;
    return profile ? { kind: "loaded", profile } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
