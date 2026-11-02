import type {
  LocalPublicationChange,
  MeetingMediaTransport,
} from "./contracts";

export const noopMeetingMediaTransport: MeetingMediaTransport = {
  connect() {
    return () => undefined;
  },
  handleLocalPublicationChange(_change: LocalPublicationChange) {},
  retry() {},
  setVideoDemand() {},
};
