import { usePathname, useRouter } from "next/navigation";

import { campusHref } from "@/core/navigation";
import { movementFor, type WorldMovement } from "@/core/realtime";
import { toast } from "@/shared/ui/toast";

// Asks world to start a walk, then brings the member to the map from any
// other page. While the socket is down it says so and goes nowhere.
export function useWalkTo(cohortId: string) {
  const pathname = usePathname();
  const router = useRouter();

  return (start: (movement: WorldMovement) => boolean) => {
    if (!start(movementFor(cohortId))) {
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
