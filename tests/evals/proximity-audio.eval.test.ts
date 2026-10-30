import { describe, expect, it, vi } from "vitest";

import { createPresenceStore } from "@/core/presence";
import type { Avatar } from "@/core/realtime";
import { parseServerMessage } from "@/core/realtime";
import { createCallMediaSession } from "@/features/campus/services/call-media/call-media-session";
import { createLivekitMeetingRoomTransport } from "@/features/campus/services/call-media/livekit-meeting-room-transport";
import type { CallAudioStatus } from "@/features/campus/services/media-session/contracts";
import {
  fakeLivekitRoom,
  type FakeRoom,
} from "@/features/campus/testing/fake-livekit";
import {
  ADA,
  GRACE,
  LIN,
  MAYA,
  nearbyFrame,
  spaceChangedFrame,
} from "@/tests/fixtures/nearby-presence";
import { serverFrames } from "@/tests/fixtures/world-frames";

function proximityCall() {
  const { call } = serverFrames.call;
  if (!call) throw new Error("The call fixture must grant a room.");
  return call;
}

const MEDIA_URL = proximityCall().url;

const identityOf = (userId: string) => `${userId}:tab-1`;

// One member's Presence Session, end to end below World: frames go through the
// real parser and presence store into the real call-media session and
// LiveKit adapter. Only livekit-client is faked.
function joinedMember() {
  const livekit = fakeLivekitRoom();
  livekit.control.alreadyInRoom = [
    [identityOf(GRACE.userId), ["microphone", "camera", "screen_share"]],
    [identityOf(LIN.userId), ["microphone"]],
    [identityOf(MAYA.userId), ["microphone"]],
    [GRACE.userId, ["microphone"]],
  ];
  const presence = createPresenceStore();
  let worldRefreshes = 0;
  const session = createCallMediaSession({
    now: () => 0,
    pinMediaUrl: (url) => (url === MEDIA_URL ? url : undefined),
    recordFirstAudioMilliseconds: () => undefined,
    // World answers a rejoin with the space's call and a freshly minted token,
    // which LiveKit accepts.
    refreshCall: () => {
      worldRefreshes += 1;
      livekit.control.connect = "resolve";
      receive({
        ...serverFrames.call,
        call: { ...proximityCall(), token: "fresh-token" },
      });
      return true;
    },
    roomTransport: createLivekitMeetingRoomTransport(
      async () => livekit.module,
    ),
  });
  const statuses: CallAudioStatus[] = [];
  const heard = new Set<string>();
  session.connect({
    onRemoteAudioGainsChange: () => undefined,
    onRemotePublicationChange: (change) => {
      if (change.type === "upserted") {
        heard.add(change.publication.participantId);
      } else {
        heard.delete(change.participantId);
      }
    },
    onStatusChange: (status) => statuses.push(status),
  });
  let counted = 0;
  let unauthorizedSubscriptions = 0;
  let countedGrants = 0;
  let unauthorizedGrants = 0;

  function isOutsideRoster(identity: string) {
    const userId = identity.split(":")[0];
    return !presence.getState().meetingRoster.includes(userId ?? "");
  }

  function countUnauthorizedSubscriptions() {
    for (const record of livekit.subscriptions.slice(counted)) {
      if (record.subscribed && isOutsideRoster(record.identity)) {
        unauthorizedSubscriptions += 1;
      }
    }
    counted = livekit.subscriptions.length;

    for (const grant of livekit.grants.slice(countedGrants)) {
      if (
        grant.allParticipantsAllowed ||
        grant.identities.some(isOutsideRoster)
      ) {
        unauthorizedGrants += 1;
      }
    }
    countedGrants = livekit.grants.length;
  }

  function receive(frame: unknown) {
    const parsed = parseServerMessage(JSON.stringify(frame));
    if (!parsed.ok) throw new Error("The eval sent a frame world would not.");
    presence.getState().apply(parsed.message);
    session.applyWorldMessage(parsed.message, presence.getState());
    countUnauthorizedSubscriptions();
  }

  // What the world session does on a recoverable close.
  function worldCloses() {
    presence.getState().clearRemoteParticipants();
    session.applyPresence(presence.getState());
    countUnauthorizedSubscriptions();
  }

  function subscribedIn(room: FakeRoom) {
    return [...room.remoteParticipants.values()].flatMap((participant) =>
      [...participant.trackPublications.values()]
        .filter(({ isDesired }) => isDesired)
        .map(({ source }) => `${participant.identity}/${source}`),
    );
  }

  async function connected(roomCount = 1) {
    await vi.waitFor(() => {
      expect(livekit.rooms).toHaveLength(roomCount);
      expect(statuses.at(-1)).toBe("connected");
    });
    countUnauthorizedSubscriptions();
  }

  receive(serverFrames.welcome);
  receive({
    type: "snapshot",
    map: serverFrames.snapshot.map,
    players: [ADA, GRACE, LIN, MAYA],
    spaces: [],
  });

  return {
    connected,
    heard,
    livekit,
    receive,
    statuses,
    subscribedIn,
    tryAgain: () => session.retry(),
    worldCloses,
    worldRefreshes: () => worldRefreshes,
    unauthorizedGrants: () => unauthorizedGrants,
    unauthorizedSubscriptions: () => unauthorizedSubscriptions,
  };
}

describe("proximity audio eval (required threshold: 8/8, 100% same-task updates, 0 unauthorized subscriptions or grants)", () => {
  it("joins world's call and subscribes only the microphones of whoever is near", async () => {
    const member = joinedMember();
    member.receive(nearbyFrame(GRACE));

    member.receive(serverFrames.call);
    await member.connected();

    expect(member.subscribedIn(member.livekit.roomAt(0))).toEqual([
      `${identityOf(GRACE.userId)}/microphone`,
    ]);
    expect(member.unauthorizedSubscriptions()).toBe(0);
    expect(member.unauthorizedGrants()).toBe(0);
  });

  it("lets only whoever is near receive the member's tracks, and nobody before", async () => {
    const member = joinedMember();
    member.receive(serverFrames.call);
    await member.connected();
    const room = member.livekit.roomAt(0);

    member.receive(nearbyFrame(GRACE, LIN));
    member.receive(nearbyFrame(LIN));

    expect(room.grants).toEqual([
      { allParticipantsAllowed: false, identities: [] },
      {
        allParticipantsAllowed: false,
        identities: [
          identityOf(GRACE.userId),
          identityOf(LIN.userId),
        ].toSorted(),
      },
      { allParticipantsAllowed: false, identities: [identityOf(LIN.userId)] },
    ]);
    expect(member.unauthorizedGrants()).toBe(0);
  });

  it("applies every nearby change to the subscriptions in the same task", async () => {
    const member = joinedMember();
    member.receive(nearbyFrame(GRACE));
    member.receive(serverFrames.call);
    await member.connected();
    const room = member.livekit.roomAt(0);
    const updates: Avatar[][] = [[LIN], [LIN, MAYA], [GRACE, MAYA], [MAYA]];
    let sameTaskUpdates = 0;

    for (const near of updates) {
      member.receive(nearbyFrame(...near));
      const expected = near.map(
        ({ userId }) => `${identityOf(userId)}/microphone`,
      );
      if (
        JSON.stringify(member.subscribedIn(room).toSorted()) ===
        JSON.stringify(expected.toSorted())
      ) {
        sameTaskUpdates += 1;
      }
    }

    expect(sameTaskUpdates / updates.length).toBe(1);
    expect(member.unauthorizedSubscriptions()).toBe(0);
    expect(member.unauthorizedGrants()).toBe(0);
  });

  it("stops the audio of anyone World no longer names as near", async () => {
    const member = joinedMember();
    member.receive(nearbyFrame(GRACE));
    member.receive(serverFrames.call);
    await member.connected();
    const room = member.livekit.roomAt(0);
    const grace = room.remoteParticipants.get(identityOf(GRACE.userId));
    if (!grace) throw new Error("Grace is not in the room.");
    room.deliver(grace, "microphone");
    expect(member.heard).toEqual(new Set([GRACE.userId]));

    member.receive(nearbyFrame());
    room.unsubscribe(grace, "microphone");

    expect(member.subscribedIn(room)).toEqual([]);
    expect(member.heard).toEqual(new Set());

    member.receive(nearbyFrame(LIN));
    member.worldCloses();

    expect(member.subscribedIn(room)).toEqual([]);
    expect(member.unauthorizedSubscriptions()).toBe(0);
    expect(member.unauthorizedGrants()).toBe(0);
  });

  it("leaves the old room before it joins the next space's room", async () => {
    const member = joinedMember();
    member.receive(nearbyFrame(GRACE));
    member.receive(serverFrames.call);
    await member.connected();

    member.receive({
      ...serverFrames.call,
      call: { ...proximityCall(), token: "next-space-token" },
    });
    await member.connected(2);
    member.receive(nearbyFrame(LIN));

    expect(member.livekit.timeline).toEqual([
      "connect:0",
      "disconnect:0",
      "connect:1",
    ]);
    expect(member.subscribedIn(member.livekit.roomAt(0))).toEqual([
      `${identityOf(GRACE.userId)}/microphone`,
    ]);
    expect(member.subscribedIn(member.livekit.roomAt(1))).toEqual([
      `${identityOf(LIN.userId)}/microphone`,
    ]);
    expect(member.unauthorizedSubscriptions()).toBe(0);
    expect(member.unauthorizedGrants()).toBe(0);
  });

  it("subscribes nobody once world ends the call or sends one it cannot hear", async () => {
    const member = joinedMember();
    member.receive(nearbyFrame(GRACE));
    member.receive(serverFrames.call);
    await member.connected();

    member.receive({ type: "call", call: null });
    member.receive(nearbyFrame(GRACE, LIN));
    expect(member.statuses.at(-1)).toBe("idle");

    member.receive(serverFrames.call);
    await member.connected(2);
    const subscriptionsBefore = member.livekit.subscriptions.length;
    member.receive({
      type: "call",
      call: { ...proximityCall(), hearing: "stage" },
    });
    member.receive(nearbyFrame(GRACE, LIN, MAYA));

    expect(member.statuses.at(-1)).toBe("idle");
    await vi.waitFor(() =>
      expect(member.livekit.timeline).toEqual([
        "connect:0",
        "disconnect:0",
        "connect:1",
        "disconnect:1",
      ]),
    );
    expect(member.livekit.subscriptions.slice(subscriptionsBefore)).toEqual([]);
    expect(member.unauthorizedSubscriptions()).toBe(0);
    expect(member.unauthorizedGrants()).toBe(0);
  });

  it("subscribes everyone in a room-hearing space and stops a mate who steps out in the same task", async () => {
    const member = joinedMember();
    member.receive(spaceChangedFrame(ADA, "library"));
    member.receive(spaceChangedFrame(GRACE, "library"));

    member.receive({
      type: "call",
      call: { ...proximityCall(), hearing: "room" },
    });
    await member.connected();
    const room = member.livekit.roomAt(0);

    expect(member.subscribedIn(room)).toEqual([
      `${identityOf(GRACE.userId)}/microphone`,
    ]);

    member.receive(spaceChangedFrame(GRACE, "_default"));

    expect(member.subscribedIn(room)).toEqual([]);
    expect(member.unauthorizedSubscriptions()).toBe(0);
    expect(member.unauthorizedGrants()).toBe(0);
  });

  it("gets audio back in place when trying again finds the grant expired", async () => {
    const member = joinedMember();
    member.livekit.control.connect = "reject";
    member.receive(nearbyFrame(GRACE));
    member.receive(serverFrames.call);
    await vi.waitFor(() => expect(member.statuses.at(-1)).toBe("unavailable"));

    member.livekit.control.connect = "deny";
    member.tryAgain();
    await member.connected(3);

    const rejoined = member.livekit.roomAt(2);
    expect(member.worldRefreshes()).toBe(1);
    expect(rejoined.connectCalls).toEqual([
      expect.objectContaining({ token: "fresh-token" }),
    ]);
    expect(member.subscribedIn(rejoined)).toEqual([
      `${identityOf(GRACE.userId)}/microphone`,
    ]);
    expect(member.unauthorizedSubscriptions()).toBe(0);
    expect(member.unauthorizedGrants()).toBe(0);
  });
});
