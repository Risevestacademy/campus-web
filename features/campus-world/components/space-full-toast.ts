import { toast } from "@/shared/ui/toast";

const SPACE_FULL_TOAST_ID = "space-full";

// A step into a space that holds as many people as it may. There is nothing to
// ask or wait for, so it only says so; one toast stands for any number of
// presses against the same door.
export function showSpaceFullToast(title: string): void {
  toast.add({
    id: SPACE_FULL_TOAST_ID,
    priority: "high",
    title,
    type: "warning",
  });
}
