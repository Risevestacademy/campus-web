import { UsersIcon } from "@phosphor-icons/react/dist/ssr/Users";

import { toast } from "@/shared/ui/toast";

const SPACE_FULL_TOAST_ID = "space-full";

// A step into a space that holds as many people as it may. There is nothing to
// ask or wait for, so it only says so; one toast stands for any number of
// presses against the same door. It wears the same icon tile as a refused
// entry, so the same door looks alike whatever keeps the member out.
export function spaceFullToast(title: string) {
  return {
    id: SPACE_FULL_TOAST_ID,
    title,
    type: "warning",
    data: {
      tile: {
        icon: <UsersIcon aria-hidden weight="bold" />,
        tone: "warning",
      },
    },
  } as const;
}

export function showSpaceFullToast(title: string): void {
  toast.add({ ...spaceFullToast(title), priority: "high" });
}
