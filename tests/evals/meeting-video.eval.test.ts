import { describe, expect, it } from "vitest";

import type { Avatar } from "@/core/realtime";
import {
  identityOf,
  joinedMember,
  proximityCall,
} from "@/tests/fixtures/call-media-member";
import {
  ADA,
  GRACE,
  LIN,
  MAYA,
  nearbyFrame,
  spaceChangedFrame,
} from "@/tests/fixtures/nearby-presence";
import { serverFrames } from "@/tests/fixtures/world-frames";

const camerasOf = (...people: Avatar[]) =>
  people.map(({ userId }) => `${identityOf(userId)}/camera`).toSorted();

function camerasSubscribedIn(
  member: ReturnType<typeof joinedMember>,
  roomIndex = 0,
) {
  return member
    .subscribedIn(member.livekit.roomAt(roomIndex))
    .filter((subscription) => subscription.endsWith("/camera"))
    .toSorted();
}

describe("meeting video eval (required threshold: 5/5, 100% same-task updates, 0 unauthorized subscriptions or grants)", () => {
  it("subscribes only the cameras on screen of whoever is near", async () => {
    const member = joinedMember();
    member.receive(nearbyFrame(GRACE, LIN));
    member.receive(serverFrames.call);
    await member.connected();

    member.showTiles([GRACE, "low"], [MAYA, "low"]);

    expect(member.subscribedIn(member.livekit.roomAt(0)).toSorted()).toEqual(
      [
        `${identityOf(GRACE.userId)}/camera`,
        `${identityOf(GRACE.userId)}/microphone`,
        `${identityOf(LIN.userId)}/microphone`,
      ].toSorted(),
    );
    expect(member.unauthorizedSubscriptions()).toBe(0);
    expect(member.unauthorizedGrants()).toBe(0);
  });

  it("applies every nearby change to the cameras in the same task", async () => {
    const member = joinedMember();
    member.receive(nearbyFrame(GRACE));
    member.receive(serverFrames.call);
    await member.connected();
    member.showTiles([GRACE, "low"], [LIN, "low"], [MAYA, "low"]);
    const updates: Avatar[][] = [[LIN], [LIN, MAYA], [GRACE, MAYA], [MAYA]];
    let sameTaskUpdates = 0;

    for (const near of updates) {
      member.receive(nearbyFrame(...near));
      if (
        JSON.stringify(camerasSubscribedIn(member)) ===
        JSON.stringify(camerasOf(...near))
      ) {
        sameTaskUpdates += 1;
      }
    }

    expect(sameTaskUpdates / updates.length).toBe(1);
    expect(member.unauthorizedSubscriptions()).toBe(0);
    expect(member.unauthorizedGrants()).toBe(0);
  });

  it("drops every camera, and every grant, at the threshold of another space", async () => {
    const member = joinedMember();
    member.receive(spaceChangedFrame(ADA, "library"));
    member.receive(spaceChangedFrame(GRACE, "library"));
    member.receive({
      type: "call",
      call: { ...proximityCall(), hearing: "room" },
    });
    await member.connected();
    member.showTiles([GRACE, "medium"]);
    expect(camerasSubscribedIn(member)).toEqual(camerasOf(GRACE));

    member.receive(spaceChangedFrame(ADA, "_default"));

    expect(camerasSubscribedIn(member)).toEqual([]);
    expect(member.livekit.roomAt(0).grants.at(-1)).toEqual({
      allParticipantsAllowed: false,
      identities: [],
    });
    expect(member.unauthorizedSubscriptions()).toBe(0);
    expect(member.unauthorizedGrants()).toBe(0);
  });

  it("asks for each camera at the size its tile shows", async () => {
    const member = joinedMember();
    member.receive(nearbyFrame(GRACE));
    member.receive(serverFrames.call);
    await member.connected();

    member.showTiles([GRACE, "low"]);
    member.receive(nearbyFrame(GRACE));
    member.showTiles([GRACE, "high"]);

    expect(member.livekit.qualities).toEqual([
      { identity: identityOf(GRACE.userId), quality: "LOW" },
      { identity: identityOf(GRACE.userId), quality: "HIGH" },
    ]);
    expect(member.unauthorizedSubscriptions()).toBe(0);
  });

  it("shows a camera only while its owner has it on", async () => {
    const member = joinedMember();
    member.receive(nearbyFrame(GRACE));
    member.receive(serverFrames.call);
    await member.connected();
    member.showTiles([GRACE, "low"]);
    const room = member.livekit.roomAt(0);
    const grace = member.participantIn(room, GRACE);
    const visible: boolean[] = [];

    room.deliver(grace, "camera");
    visible.push(member.seen.has(GRACE.userId));
    room.mute(grace, "camera", true);
    visible.push(member.seen.has(GRACE.userId));
    room.mute(grace, "camera", false);
    visible.push(member.seen.has(GRACE.userId));
    room.unpublish(grace, "camera");
    visible.push(member.seen.has(GRACE.userId));

    expect(visible).toEqual([true, false, true, false]);
    expect(member.unauthorizedSubscriptions()).toBe(0);
  });
});
