import type { ApiClient } from "@/core/api/client";

import { parseOwnProfile } from "../schemas/own-profile.schema";
import type { AvatarChange, AvatarProblem } from "../types";

const avatarProblems: Record<number, AvatarProblem> = {
  401: "signed-out",
  404: "expired",
  422: "mismatch",
};

function changeOf(response: Response, data: unknown): AvatarChange {
  if (!response.ok) {
    return {
      kind: "problem",
      problem: avatarProblems[response.status] ?? "unavailable",
    };
  }
  const profile = parseOwnProfile(data);
  return profile
    ? { kind: "changed", profile }
    : { kind: "problem", problem: "unavailable" };
}

export async function setAvatar(
  api: ApiClient,
  mediaId: string,
): Promise<AvatarChange> {
  try {
    const { data, response } = await api.PUT("/v1/users/me/avatar", {
      body: { mediaId },
    });
    return changeOf(response, data);
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

export async function removeAvatar(api: ApiClient): Promise<AvatarChange> {
  try {
    const { data, response } = await api.DELETE("/v1/users/me/avatar");
    return changeOf(response, data);
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
