import Image from "next/image";

import campusMap from "@/assets/landing-page/editable-spatial-illustration.svg";

import { CampusCapabilities } from "./campus-capabilities";

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
