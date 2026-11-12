import type { Icon } from "@phosphor-icons/react";
import { ArrowUUpLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowUUpLeft";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { ClockIcon } from "@phosphor-icons/react/dist/ssr/Clock";
import { InfoIcon } from "@phosphor-icons/react/dist/ssr/Info";
import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr/LockSimple";
import { LockSimpleOpenIcon } from "@phosphor-icons/react/dist/ssr/LockSimpleOpen";
import { SignOutIcon } from "@phosphor-icons/react/dist/ssr/SignOut";
import { UserMinusIcon } from "@phosphor-icons/react/dist/ssr/UserMinus";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/ssr/WifiSlash";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";

import { toast, type ToastTileTone } from "@/shared/ui/toast";

import type {
  EntryLook,
  EntryToast,
} from "../services/space-locks/ask-to-enter";

const LOOKS: Record<EntryLook, { Icon: Icon; tone: ToastTileTone }> = {
  locked: { Icon: LockSimpleIcon, tone: "locked" },
  asking: { Icon: CircleNotchIcon, tone: "progress" },
  admitted: { Icon: CheckIcon, tone: "success" },
  declined: { Icon: ClockIcon, tone: "warning" },
  withdrawn: { Icon: ArrowUUpLeftIcon, tone: "neutral" },
  "walked-away": { Icon: SignOutIcon, tone: "neutral" },
  nobody: { Icon: UserMinusIcon, tone: "warning" },
  unlocked: { Icon: LockSimpleOpenIcon, tone: "success" },
  closed: { Icon: InfoIcon, tone: "neutral" },
  dropped: { Icon: WifiSlashIcon, tone: "warning" },
  failed: { Icon: XIcon, tone: "error" },
};

// Adding under a live toast's id merges into it, so every optional field is
// set, even to nothing, or the last state's text and wait would linger.
export function showEntryToast({
  actions,
  description,
  look,
  priority,
  timeout,
  ...rest
}: EntryToast) {
  const { Icon, tone } = LOOKS[look];
  toast.add({
    ...rest,
    description,
    priority,
    timeout,
    data: {
      tile: {
        actions,
        icon: (
          <Icon
            aria-hidden
            weight="bold"
            className={look === "asking" ? "animate-spin" : undefined}
          />
        ),
        tone,
      },
    },
  });
}
