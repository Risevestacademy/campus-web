"use client";

import { useMediaElementRef } from "../hooks/use-media-element-ref";
import { useRemoteAudioVolume } from "../hooks/use-remote-audio-volume";
import type { RemoteMediaPublication } from "../services/media-session/contracts";
import { useMediaSession } from "../services/media-session/media-session-provider";

function RemoteAudio({
  outputDeviceId,
  publication,
}: Readonly<{ outputDeviceId: string; publication: RemoteMediaPublication }>) {
  const volume = useRemoteAudioVolume(publication.participantId);
  const audioRef = useMediaElementRef(publication, outputDeviceId, volume);

  return (
    <audio
      ref={audioRef}
      autoPlay
      aria-label={`${publication.participantId} audio`}
    />
  );
}

// One mix for the whole Presence Session, so changing page or meeting layout
// never interrupts what the member hears.
export function RemoteAudioOutput() {
  const remotePublications = useMediaSession(
    (state) => state.remotePublications,
  );
  const outputDeviceId = useMediaSession(
    (state) => state.output.selectedDeviceId,
  );

  return Object.values(remotePublications).map(({ microphone }) =>
    microphone ? (
      <RemoteAudio
        key={microphone.publicationId}
        outputDeviceId={outputDeviceId}
        publication={microphone}
      />
    ) : null,
  );
}
