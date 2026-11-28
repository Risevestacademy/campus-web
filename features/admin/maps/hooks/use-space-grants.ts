import { useQuery, useQueryClient } from "@tanstack/react-query";

import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import {
  endSpaceGrant,
  grantSpaceAccess,
  listSpaceGrants,
} from "../services/space-grants-api.adapter";
import type {
  EndGrantProblem,
  GrantTarget,
  SpaceGrantProblem,
} from "../types/maps.types";

const grantsKey = (spaceId: string) => ["maps", "space-grants", spaceId];

// A space's list is read when its sheet shows it, and read again after
// each change to it. Nothing else on the page depends on the list, so a
// change re-reads it rather than refreshing the page.
export function useSpaceGrants(spaceId: string) {
  const queryClient = useQueryClient();
  const grants = useQuery({
    queryKey: grantsKey(spaceId),
    queryFn: () => listSpaceGrants(browserApi, spaceId),
    retry: false,
  });
  const reread = () =>
    queryClient.invalidateQueries({ queryKey: grantsKey(spaceId) });

  const granting = useAdminMutation<GrantTarget, SpaceGrantProblem>({
    mutationFn: (target) => grantSpaceAccess(browserApi, spaceId, target),
    onSucceeded: () => {
      toast.add({ title: "Added to the list", type: "success" });
      void reread();
    },
    refreshAfterSuccess: false,
  });

  const ending = useAdminMutation<string, EndGrantProblem>({
    mutationFn: (grantId) => endSpaceGrant(browserApi, spaceId, grantId),
    onSucceeded: () => {
      toast.add({ title: "Removed from the list", type: "success" });
      void reread();
    },
    refreshAfterSuccess: false,
  });

  return { read: grants.data, isLoading: grants.isPending, granting, ending };
}
