import { describe, expect, it, vi } from "vitest";

import {
  identityOf,
  joinedMember,
  proximityCall,
} from "@/tests/fixtures/call-media-member";
import {
  ADA,
  GRACE,
  LIN,
  nearbyFrame,
  spaceChangedFrame,
} from "@/tests/fixtures/nearby-presence";
import { serverFrames } from "@/tests/fixtures/world-frames";

const SCREEN_SOURCE = "screen_share";

function screensPublishedIn(
  member: ReturnType<typeof joinedMember>,
  roomIndex: number,
) {
  return member.livekit
    .roomAt(roomIndex)
    .published.filter(
      ({ options }) => (options as { source: string }).source === SCREEN_SOURCE,
    );
}

async function meetingGrace() {
  const member = joinedMember();
  member.receive(nearbyFrame(GRACE));
  member.receive(serverFrames.call);
  await member.connected();
  return member;
}

describe("screen share eval (required threshold: 7/7, 0 unauthorized subscriptions or grants, 0 captures left running)", () => {
  it("reaches only the roster: others' shares are known only from people met, and only they may receive this one", async () => {
    const member = await meetingGrace();
    const room = member.livekit.roomAt(0);
    room.arrive(identityOf(LIN.userId), [SCREEN_SOURCE]);

    await member.startSharing();

    expect(screensPublishedIn(member, 0)).toHaveLength(1);
    expect(room.grants.at(-1)).toEqual({
      allParticipantsAllowed: false,
      identities: [identityOf(GRACE.userId)],
    });
    expect(member.othersSharing()).toEqual(new Set([GRACE.userId]));
    expect(member.unauthorizedGrants()).toBe(0);
  });

  it("pulls a share only while its tile is on screen", async () => {
    const member = await meetingGrace();
    const shareOfGrace = `${identityOf(GRACE.userId)}/${SCREEN_SOURCE}`;
    const subscribed = () => member.subscribedIn(member.livekit.roomAt(0));
    expect(subscribed()).not.toContain(shareOfGrace);

    member.showShares([GRACE, "low"]);
    expect(subscribed()).toContain(shareOfGrace);

    member.showShares();
    expect(subscribed()).not.toContain(shareOfGrace);
    expect(member.unauthorizedSubscriptions()).toBe(0);
  });

  it("stops capture at the threshold of another space, as the call changing", async () => {
    const member = joinedMember();
    member.receive(spaceChangedFrame(ADA, "library"));
    member.receive(spaceChangedFrame(GRACE, "library"));
    member.receive({
      type: "call",
      call: { ...proximityCall(), hearing: "room" },
    });
    await member.connected();
    await member.startSharing();
    expect(member.captureRunning()).toBe(true);

    member.receive(spaceChangedFrame(ADA, "_default"));

    expect(member.captureRunning()).toBe(false);
    expect(member.shareOutcome()).toBe("room_closed");
  });

  it("takes the share off a closing room, and never publishes it in the next", async () => {
    const member = await meetingGrace();
    await member.startSharing();

    member.receive({
      ...serverFrames.call,
      call: { ...proximityCall(), token: "next-room" },
    });

    expect(member.captureRunning()).toBe(false);
    await member.connected(2);
    expect(member.livekit.roomAt(0).unpublished).toHaveLength(1);
    expect(screensPublishedIn(member, 1)).toEqual([]);
  });

  it("stops capture in the same task as the last person walks out of range", async () => {
    const member = await meetingGrace();
    await member.startSharing();

    member.receive(nearbyFrame());

    expect(member.captureRunning()).toBe(false);
    expect(member.shareOutcome()).toBe("meeting_ended");
  });

  it("keeps the call when the room refuses the share, and stops capture", async () => {
    const member = await meetingGrace();
    const room = member.livekit.roomAt(0);
    room.publishFails = true;

    await member.startSharing();

    await vi.waitFor(() => expect(member.captureRunning()).toBe(false));
    expect(member.statuses.at(-1)).toBe("connected");
    expect(room.disconnectCalls).toEqual([]);
  });

  it("stops capture when the Presence Session ends", async () => {
    const member = await meetingGrace();
    await member.startSharing();

    member.leave();

    expect(member.captureRunning()).toBe(false);
  });
});
