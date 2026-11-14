import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/core/api/client/browser";

import { readOwnProfile } from "../services/own-profile-api.adapter";

export const OWN_PROFILE_KEY = ["profile", "own"] as const;

const FIVE_MINUTES = 5 * 60_000;

// A loaded profile is fresh for five minutes, so opening the account menu
// again does not ask; a failed read is not kept, so the next open tries again.
export function useOwnProfile() {
  const query = useQuery({
    queryKey: OWN_PROFILE_KEY,
    queryFn: () => readOwnProfile(browserApi),
    staleTime: (current) =>
      current.state.data?.kind === "loaded" ? FIVE_MINUTES : 0,
    retry: false,
  });

  return query.data;
}
