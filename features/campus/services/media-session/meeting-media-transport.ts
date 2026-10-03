import type {
  LocalPublicationChange,
  MeetingMediaTransport,
} from "./contracts";

export const noopMeetingMediaTransport: MeetingMediaTransport = {
  handleLocalPublicationChange(_change: LocalPublicationChange) {},
  subscribeToRemotePublications() {
    return () => undefined;
  },
};
