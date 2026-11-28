"use client";

import { MicrophoneIcon } from "@phosphor-icons/react/dist/ssr/Microphone";
import { MicrophoneSlashIcon } from "@phosphor-icons/react/dist/ssr/MicrophoneSlash";
import { cn } from "cn";

import { Avatar, AvatarFallback } from "@/shared/ui/avatar";

import { useMediaSession } from "../../services/media-session/media-session-provider";
import { OWN_NAME } from "../../services/own-name";
import type { MeetingParticipant } from "../../types/active-campus.types";

// One person in the meeting, with whether their microphone is on: the same
// read the meeting tiles make.
export function PersonRow({
  isLocal,
  participant,
}: Readonly<{ isLocal: boolean; participant: MeetingParticipant }>) {
  const microphone = useMediaSession((state) =>
    isLocal
      ? state.localPublications.microphone
      : state.remotePublications[participant.id]?.microphone,
  );
  const live = microphone?.enabled === true;
  const MicIcon = live ? MicrophoneIcon : MicrophoneSlashIcon;

  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2">
      <Avatar>
        <AvatarFallback
          className={cn("text-sm font-medium", participant.avatarClassName)}
        >
          {participant.initial}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {isLocal ? OWN_NAME : participant.name}
      </span>
      <MicIcon
        aria-hidden="true"
        className={cn("size-4 shrink-0", live ? "text-success" : "text-error")}
      />
      <span className="sr-only">
        {live ? "Microphone on" : "Microphone off"}
      </span>
    </li>
  );
}
