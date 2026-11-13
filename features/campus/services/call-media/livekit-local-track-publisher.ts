import type {
  LocalTrack,
  LocalTrackPublication,
  Room,
  Track,
  TrackPublishOptions,
} from "livekit-client";

import type { LocalPublicationChange } from "../media-session/contracts";

// Publishes copies: LiveKit may stop a track it fails to publish, and the
// member's own track must outlive the room. Changes run in order, and any
// still queued at close never clone.
export function localTrackPublisher(
  room: Room,
  source: Track.Source,
  publishOptions: Readonly<TrackPublishOptions> = {},
) {
  const copies = new Set<MediaStreamTrack>();
  let published:
    | Readonly<{ copy: MediaStreamTrack; publication: LocalTrackPublication }>
    | undefined;
  let pending = Promise.resolve();
  let closed = false;

  function copyOf(track: MediaStreamTrack) {
    const copy = track.clone();
    // A hint that did not survive the clone would soften a shared screen's text.
    copy.contentHint = track.contentHint;
    copies.add(copy);
    return copy;
  }

  function stopCopy(copy: MediaStreamTrack) {
    copy.stop();
    copies.delete(copy);
  }

  // A copy LiveKit never took would run until close().
  async function withCopy(
    track: MediaStreamTrack,
    handOver: (copy: MediaStreamTrack) => Promise<void>,
  ) {
    const copy = copyOf(track);
    try {
      await handOver(copy);
    } catch (error) {
      stopCopy(copy);
      throw error;
    }
  }

  function publish(track: MediaStreamTrack) {
    return withCopy(track, async (copy) => {
      const publication = await room.localParticipant.publishTrack(copy, {
        ...publishOptions,
        source,
      });
      published = { copy, publication };
    });
  }

  function replace(track: MediaStreamTrack) {
    const current = published;
    const localTrack = current?.publication.track;
    if (!current || !localTrack) return publish(track);
    return withCopy(track, async (copy) => {
      try {
        await localTrack.replaceTrack(copy, true);
      } catch (error) {
        // The member switched away from this device, so it must not keep
        // sending. LiveKit finds a bare MediaStreamTrack by identity, which a
        // partial swap can break, so name its own track.
        await unpublish(localTrack);
        throw error;
      }
      stopCopy(current.copy);
      published = { ...current, copy };
    });
  }

  async function unpublish(localTrack?: LocalTrack) {
    if (!published) return;
    const { copy } = published;
    published = undefined;
    try {
      await room.localParticipant.unpublishTrack(localTrack ?? copy, false);
    } finally {
      stopCopy(copy);
    }
  }

  function apply(change: LocalPublicationChange) {
    if (closed) return;
    if (change.type === "added") return publish(change.publication.track);
    if (change.type === "replaced") return replace(change.publication.track);
    return unpublish();
  }

  return {
    handle(change: LocalPublicationChange) {
      const applied = pending.then(() => apply(change));
      pending = applied.catch(() => undefined);
      return applied;
    },
    close() {
      closed = true;
      for (const copy of copies) stopCopy(copy);
    },
  };
}
