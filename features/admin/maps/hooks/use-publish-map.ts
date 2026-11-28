import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { publishMap } from "../services/maps-api.adapter";
import type { MapPublishProblem } from "../types/maps.types";

export function usePublishMap({ mapKey }: { mapKey: string }) {
  const { mutate, ...controls } = useAdminMutation<string, MapPublishProblem>({
    mutationFn: (mapId) => publishMap(browserApi, mapId),
    onSucceeded: () => {
      toast.add({
        title: `${mapKey} is live`,
        description: "The campus now serves the synced map.",
        type: "success",
      });
    },
  });

  return { publish: mutate, ...controls };
}
