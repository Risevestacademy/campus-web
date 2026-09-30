export type QuickTransportDestination = {
  id: string;
  label: string;
  dotClassName: string;
  isLiveNow?: boolean;
};

/** Placeholder destinations until the map feature owns real navigation. */
export const quickTransportDestinations: readonly QuickTransportDestination[] =
  [
    {
      id: "now-next",
      label: "Now & next",
      dotClassName: "bg-info-500",
      isLiveNow: true,
    },
    { id: "classroom-a", label: "Classroom A", dotClassName: "bg-info-500" },
    {
      id: "faculty-hallway",
      label: "Faculty Hallway",
      dotClassName: "bg-cobalt-400",
    },
    {
      id: "project-studio",
      label: "Project Studio",
      dotClassName: "bg-lemon-400",
    },
    {
      id: "resource-library",
      label: "Resource Library",
      dotClassName: "bg-lemon-400",
    },
    { id: "public-hall", label: "Public Hall", dotClassName: "bg-error-400" },
  ];
