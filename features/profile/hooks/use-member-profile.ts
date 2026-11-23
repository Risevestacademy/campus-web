import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/core/api/client/browser";

import { readMemberProfile } from "../services/member-profile-api.adapter";

const FIVE_MINUTES = 5 * 60_000;

export function memberProfileKey(userId: string) {
  return ["profile", "member", userId] as const;
}

// As the member's own profile: a loaded card is fresh for five minutes, and a
// failed read is not kept, so opening the card again tries again.
export function useMemberProfile(userId: string) {
  const query = useQuery({
    queryKey: memberProfileKey(userId),
    queryFn: () => readMemberProfile(browserApi, userId),
    staleTime: (current) =>
      current.state.data?.kind === "loaded" ? FIVE_MINUTES : 0,
    retry: false,
  });

  return query.data;
}
