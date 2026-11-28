import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { updateSpace } from "../services/maps-api.adapter";
import type { SpaceChanges, SpaceUpdateProblem } from "../types/maps.types";

export function useUpdateSpace({
  spaceId,
  name,
  onSaved,
}: {
  spaceId: string;
  name: string;
  onSaved: () => void;
}) {
  const { mutate, ...controls } = useAdminMutation<
    SpaceChanges,
    SpaceUpdateProblem
  >({
    mutationFn: (changes) => updateSpace(browserApi, spaceId, changes),
    onSucceeded: () => {
      toast.add({ title: "Space saved", description: name, type: "success" });
      onSaved();
    },
  });

  return { save: mutate, ...controls };
}
