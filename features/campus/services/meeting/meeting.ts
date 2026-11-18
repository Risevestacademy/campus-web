import { type Participant, type Presence, spaceNameOf } from "@/core/presence";

import type {
  Meeting,
  MeetingParticipant,
  MeetingTile,
  MeetingTileLayout,
  OpenedMeetingLayout,
} from "../../types/active-campus.types";
import type { VideoLayer } from "../media-session/contracts";
import { meetingParticipantOf } from "./participant-identity";

type MeetingPresence = Pick<
  Presence,
  | "selfId"
  | "participants"
  | "meetingRoster"
  | "encounter"
  | "hearing"
  | "spaceNames"
>;

function rosterParticipants({
  participants,
  meetingRoster,
}: MeetingPresence): Participant[] {
  return meetingRoster.flatMap((userId) => {
    const participant = participants.get(userId);
    return participant ? [participant] : [];
  });
}

export function selectMeeting(presence: MeetingPresence): Meeting | null {
  const self =
    presence.selfId === null
      ? undefined
      : presence.participants.get(presence.selfId);
  const others = rosterParticipants(presence);
  if (!self || others.length === 0) return null;

  const inRoom = presence.hearing === "room";
  return {
    encounter: presence.encounter,
    hearing: inRoom ? "room" : "proximity",
    title: inRoom ? spaceNameOf(presence, self.spaceKey) : "Nearby",
    localParticipantId: self.userId,
    participants: [self, ...others].map(meetingParticipantOf),
  };
}

export function splitAtCap<Item>(
  items: readonly Item[],
  cap: number,
): { shown: Item[]; remaining: number } {
  return {
    shown: items.slice(0, cap),
    remaining: Math.max(0, items.length - cap),
  };
}

export function meetingGridShape(tileCount: number) {
  const columns = Math.ceil(Math.sqrt(tileCount));
  return { columns, rows: Math.ceil(tileCount / columns) };
}

const screenTile =
  (kind: "screen" | "own-screen") =>
  (participant: MeetingParticipant): MeetingTile => ({
    id: `screen:${participant.id}`,
    kind,
    participant,
  });

export function meetingTiles(
  { localParticipantId, participants }: Meeting,
  sharerIds: ReadonlySet<string>,
  isSharing: boolean,
): MeetingTile[] {
  const ownScreen = participants
    .filter(({ id }) => isSharing && id === localParticipantId)
    .map(screenTile("own-screen"));
  const screens = participants
    .filter(({ id }) => id !== localParticipantId && sharerIds.has(id))
    .map(screenTile("screen"));
  const people = participants.map((participant): MeetingTile => ({
    id: participant.id,
    kind: "person",
    participant,
  }));
  return [...ownScreen, ...screens, ...people];
}

export function visibleMeetingLayout(
  layout: OpenedMeetingLayout,
  encounter: number,
  tiles: readonly MeetingTile[],
): MeetingTileLayout {
  if (layout.mode === "compact" || layout.encounter !== encounter) {
    return { mode: "compact" };
  }

  const focusIsShown = tiles.some(({ id }) => id === layout.focusedTileId);
  return {
    mode: "expanded",
    focusedTileId: focusIsShown ? layout.focusedTileId : null,
  };
}

export function tileVideoLayer(
  layout: MeetingTileLayout,
  tileId: MeetingTile["id"],
): VideoLayer {
  if (layout.mode === "compact") return "low";
  if (layout.focusedTileId === null) return "medium";
  return layout.focusedTileId === tileId ? "high" : "low";
}
