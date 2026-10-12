import type { FeedbackItem } from "./types";

export const mockFeedbackHistory: readonly FeedbackItem[] = [
  {
    id: "mic-muted-after-rejoining",
    kind: "bug",
    title: "Mic stays muted after rejoining",
    details:
      "After leaving a pod and coming back, my mic shows as on but nobody can hear me until I toggle it twice.",
    location: "Mentor pod 2",
    submittedLabel: "3 days ago",
  },
  {
    id: "dark-mode-for-the-map",
    kind: "idea",
    title: "Dark mode for the map",
    details:
      "The sidebar follows my theme but the map stays bright, which is hard on the eyes in the evening.",
    location: "Map view",
    submittedLabel: "1 week ago",
  },
  {
    id: "notice-board-hard-to-find",
    kind: "report",
    title: "Notice board was hard to find",
    details: "",
    location: "",
    submittedLabel: "2 weeks ago",
  },
];
