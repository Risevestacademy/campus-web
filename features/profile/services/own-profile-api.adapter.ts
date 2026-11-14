import type { ApiClient } from "@/core/api/client";

import { parseOwnProfile } from "../schemas/own-profile.schema";
import type {
  OwnProfileRead,
  ProfilePatch,
  ProfileSave,
  ProfileSaveProblem,
} from "../types";

export async function readOwnProfile(api: ApiClient): Promise<OwnProfileRead> {
  try {
    const { data, response } = await api.GET("/v1/users/me");
    if (response.status === 401) return { kind: "signed-out" };
    const profile = response.ok ? parseOwnProfile(data) : undefined;
    return profile ? { kind: "loaded", profile } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

const saveProblems: Record<number, ProfileSaveProblem> = {
  400: "invalid",
  401: "signed-out",
};

export async function saveOwnProfile(
  api: ApiClient,
  changes: ProfilePatch,
): Promise<ProfileSave> {
  try {
    const { data, response } = await api.PATCH("/v1/users/me", {
      body: changes,
    });
    if (!response.ok) {
      return {
        kind: "problem",
        problem: saveProblems[response.status] ?? "unavailable",
      };
    }
    const profile = parseOwnProfile(data);
    return profile
      ? { kind: "saved", profile }
      : { kind: "problem", problem: "unavailable" };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
