import Image from "next/image";

import campusMap from "@/assets/landing-page/editable-spatial-illustration.svg";

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

function CampusCapabilities() {
  return (
    <ol className="grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
      {capabilities.map(({ title, description }, index) => (
        <li key={title} className="border-t border-[#D3DAE9] pt-6">
          <span className="text-primary text-base font-semibold md:text-[1.25rem] lg:text-[1.5rem]">
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

export function ExploreCampusSection() {
  return (
    <section
      id="explore-campus"
      aria-labelledby="explore-campus-heading"
      className="content-grid bg-background font-display scroll-mt-22 py-16 md:scroll-mt-28 md:py-24"
    >
      <div>
        <p className="text-primary text-sm font-medium tracking-wider uppercase md:text-base">
          Explore Campus
        </p>

        <div className="mt-4 md:grid md:grid-cols-2 md:items-center md:gap-10">
          <h2
            id="explore-campus-heading"
            className="text-foreground text-4xl font-semibold md:text-5xl"
          >
            <span className="block">Get to know</span>
            <span className="block">your Campus.</span>
          </h2>
          <p className="text-foreground-secondary mt-4 text-lg md:mt-0 md:text-xl">
            One map connects your classrooms, shared spaces and the people in
            your cohort. Here’s what you’ll find inside.
          </p>
        </div>

        <div className="mt-10 rounded-2xl bg-[#EFFAFF] p-2 md:mt-12 md:p-4">
          <Image
            src={campusMap}
            alt="Map of the Campus showing Town Hall, the Notice Wall, the Resource Centre, Common Area, Admin, Faculty and the private rooms."
            className="mx-auto h-auto w-full"
          />
        </div>

        <p className="text-foreground-secondary mt-8 text-center text-lg md:text-xl">
          Different spaces. One connected campus.
        </p>

        <div className="mt-10 md:mt-14">
          <CampusCapabilities />
        </div>
      </div>
    </section>
  );
}
