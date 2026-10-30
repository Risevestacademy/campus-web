// Fixed placeholder figures for the person page. campus-api has no
// attendance, check-in, desk or mentor data yet, so every person shows the
// same numbers. Replace each block with a read when its endpoint exists.

export const SAMPLE_STATS = [
  { label: "Attendance", value: "58%", unit: "", note: "Track average 71%" },
  {
    label: "Check-ins passed",
    value: "5",
    unit: "of 12",
    note: "7 missed this week",
  },
  {
    label: "Avg time in class",
    value: "34",
    unit: "min",
    note: "Minimum is 45 min",
  },
  {
    label: "Classes missed",
    value: "3",
    unit: "this week",
    note: "Last attended Mon",
  },
] as const;

export const SAMPLE_HISTORY = [
  {
    day: "Wed 30 Sep",
    time: "14:00 – 15:00",
    session: "Design Foundations",
    detail: "Time in class — · check-ins —",
    outcome: "Absent",
  },
  {
    day: "Wed 30 Sep",
    time: "10:00 – 11:00",
    session: "UX Writing studio",
    detail: "Time in class 22 of 60 min · check-ins 1 of 3",
    outcome: "Partial",
  },
  {
    day: "Tue 29 Sep",
    time: "14:00 – 15:00",
    session: "Design Foundations",
    detail: "Time in class — · check-ins —",
    outcome: "Absent",
  },
  {
    day: "Mon 28 Sep",
    time: "10:00 – 11:00",
    session: "UX Writing studio",
    detail: "Time in class 58 of 60 min · check-ins 3 of 3",
    outcome: "Present",
  },
  {
    day: "Mon 28 Sep",
    time: "14:00 – 15:00",
    session: "Design Foundations",
    detail: "Time in class — · check-ins —",
    outcome: "Absent",
  },
] as const;

export const SAMPLE_ON_CAMPUS = [
  { label: "Desk", value: "Main hallway · desk 14" },
  { label: "Usually online", value: "Mon–Fri · 10:00–13:00" },
  { label: "Mentor", value: "Catherine Onyeulo" },
  { label: "Reports", value: "None" },
] as const;

export type SampleOutcome = (typeof SAMPLE_HISTORY)[number]["outcome"];
