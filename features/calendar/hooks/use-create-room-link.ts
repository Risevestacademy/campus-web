import { useMutation } from "@tanstack/react-query";

import { browserApi } from "@/core/api/client/browser";

import { createRoomLink } from "../services/room-link-api.adapter";

export function useCreateRoomLink(cohortId: string) {
  return useMutation({
    mutationFn: ({ spaceId, title }: { spaceId: string; title: string }) =>
      createRoomLink(browserApi, cohortId, spaceId, title),
    retry: false,
  });
}
