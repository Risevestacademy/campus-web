import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/core/api/client/browser";

import { readLinkableSpaces } from "../services/room-link-api.adapter";

const FIVE_MINUTES = 5 * 60_000;

// The spaces an admin may choose for a link, read only once the dialog is
// open. A failed read is not kept, so reopening asks again.
export function useLinkableSpaces(enabled: boolean) {
  return useQuery({
    queryKey: ["calendar", "linkable-spaces"],
    queryFn: ({ signal }) => readLinkableSpaces(browserApi, signal),
    enabled,
    staleTime: (current) =>
      current.state.data?.kind === "loaded" ? FIVE_MINUTES : 0,
    retry: false,
  });
}
