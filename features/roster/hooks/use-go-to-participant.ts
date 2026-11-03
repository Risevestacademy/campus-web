import { usePathname, useRouter } from "next/navigation";

import { campusHref } from "@/core/navigation";
import { movementFor } from "@/core/realtime";
import { toast } from "@/shared/ui/toast";

export function useGoToParticipant(cohortId: string) {
  const pathname = usePathname();
  const router = useRouter();

  return (participantId: string) => {
    if (!movementFor(cohortId).sendGoTo(participantId)) {
      toast.add({
        title: "You're reconnecting. Try again in a moment.",
        type: "warning",
      });
      return;
    }

    const map = campusHref(cohortId);
    if (pathname !== map) router.push(map);
  };
}
