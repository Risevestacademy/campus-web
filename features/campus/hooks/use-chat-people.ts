import { useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import { presenceFor } from "@/core/presence";

import { selectChatPeople } from "../services/chat/chat-people";

// As `useMeeting`: select the stable references, then derive.
export function useChatPeople(cohortId: string) {
  const presence = useStore(
    presenceFor(cohortId),
    useShallow(
      ({
        selfId,
        participants,
        meetingRoster,
        encounter,
        hearing,
        spaceNames,
      }) => ({
        selfId,
        participants,
        meetingRoster,
        encounter,
        hearing,
        spaceNames,
      }),
    ),
  );

  return useMemo(() => selectChatPeople(presence), [presence]);
}
