export type OverviewStatId = "online" | "live" | "attendance" | "review";

export interface OverviewStat {
  id: OverviewStatId;
  label: string;
  value: string;
  caption: string;
}

export type ScheduleTone = "cobalt" | "violet" | "error";

export interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  detail: string;
  tone: ScheduleTone;
  isLive?: boolean;
}

export const mockOverview = {
  period: "This week · 28 Sep – 4 Oct",
  stats: [
    {
      id: "online",
      label: "Online now",
      value: "47",
      caption: "of 214 enrolled",
    },
    {
      id: "live",
      label: "Live now",
      value: "2",
      caption: "classes · Town Hall 18:00",
    },
    {
      id: "attendance",
      label: "Attendance",
      value: "86%",
      caption: "avg this week",
    },
  ],
  today: {
    label: "Wed 30 Sep",
    schedule: [
      {
        id: "design-foundations",
        time: "14:00",
        title: "Design Foundations",
        detail: "Classroom A · Chiemezie · 29 in",
        tone: "cobalt",
        isLive: true,
      },
      {
        id: "layout-systems",
        time: "16:00",
        title: "Front-end: Layout systems",
        detail: "Classroom B · Sophia",
        tone: "cobalt",
      },
      {
        id: "mentor-pod",
        time: "17:30",
        title: "Mentor pod",
        detail: "Mentor pod 3 · Chiemezie",
        tone: "violet",
      },
      {
        id: "town-hall",
        time: "18:00",
        title: "Town Hall",
        detail: "Public Hall · broadcast",
        tone: "error",
      },
    ],
  },
} as const satisfies {
  period: string;
  stats: readonly OverviewStat[];
  today: { label: string; schedule: readonly ScheduleItem[] };
};
