const capabilities = [
  {
    title: "Find your class",
    description:
      "Head to your faculty and enter the classroom assigned to your cohort.",
  },
  {
    title: "See who’s around",
    description:
      "Check active participants and their availability before you start a conversation.",
  },
  {
    title: "Make room for a conversation",
    description:
      "Meet a mentor or a small group in a private room. Schedule a session, share an invitation and manage entry.",
  },
  {
    title: "Have a place of your own",
    description:
      "Claim a desk in your faculty. It gives your name, profile and availability a familiar place on campus.",
  },
  {
    title: "Know what’s happening",
    description:
      "Follow your class and meeting schedule. Find campus events at Town Hall, and check the Notice Wall for announcements and deadlines.",
  },
  {
    title: "Find your learning resources",
    description:
      "Visit the Resource Centre to continue to Rise Classroom, where your learning materials live.",
  },
];

export function CampusCapabilities() {
  return (
    <ol className="grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
      {capabilities.map(({ title, description }, index) => (
        <li key={title} className="border-t border-[#D3DAE9] pt-6">
          <span className="text-primary text-sm md:text-base">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-foreground mt-3 text-xl font-medium md:text-2xl">
            {title}
          </h3>
          <p className="text-foreground-secondary mt-3 text-base md:text-lg">
            {description}
          </p>
        </li>
      ))}
    </ol>
  );
}
