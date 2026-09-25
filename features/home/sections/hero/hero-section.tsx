import { ArrowDownIcon } from "@phosphor-icons/react/dist/ssr/ArrowDown";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import Link from "next/link";

import mentorship from "@/assets/landing-page/mentorship.svg";
import yourCohort from "@/assets/landing-page/your-cohort.svg";

import { HeroCard } from "./hero-card";
import { HeroNavigation } from "./hero-navigation";
import { enterCampusHref } from "./navigation-links";

export function HeroSection() {
  return (
    <section
      id="hero"
      aria-labelledby="home-hero-heading"
      className="content-grid bg-primary text-background relative overflow-hidden pt-(--hero-nav-height) pb-12 [--hero-nav-height:5.5rem] md:pb-28 md:[--hero-nav-height:7rem] lg:min-h-216 lg:pb-32"
    >
      <HeroNavigation />

      <div className="flex flex-col items-center pt-12 text-center md:pt-16 lg:pt-20">
        <p className="text-xs font-medium tracking-wider uppercase md:text-sm">
          Your Rise community
        </p>

        <h1
          id="home-hero-heading"
          className="font-display mt-6 text-5xl leading-none font-bold tracking-tighter uppercase md:text-7xl lg:text-8xl xl:text-[6.5rem]"
        >
          <span className="block">Your people.</span>
          <span className="block">Your place.</span>
          <span className="text-accent block">Your campus.</span>
        </h1>

        <p className="mt-8 max-w-152 text-lg leading-relaxed md:text-xl">
          Campus by Rise is the online home for your Rise cohort. Join classes,
          meet your peers and mentors, and keep up with campus life in one
          shared space.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4 md:flex-row md:gap-8">
          <Link
            href={enterCampusHref}
            className="bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active outline-background inline-flex h-14 items-center gap-2 rounded-lg px-7 text-lg font-medium focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Enter Campus
            <ArrowUpRightIcon aria-hidden size={20} weight="regular" />
          </Link>
          <Link
            href="#explore-campus"
            className="outline-background inline-flex items-center gap-2 rounded-sm text-lg hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Explore Campus
            <ArrowDownIcon aria-hidden size={20} weight="regular" />
          </Link>
        </div>

        <p className="mt-8 text-sm">Access is by invitation only.</p>
      </div>

      <p className="bg-accent text-accent-foreground font-display absolute top-40 right-[-2%] hidden w-52 rotate-5 rounded-lg px-4 py-3 text-center text-xl leading-tight font-medium text-balance lg:block">
        Made for learning together.
      </p>

      <div className="mt-12 grid grid-cols-2 items-start gap-3 md:pointer-events-none md:absolute md:inset-0 md:mt-0 md:block">
        <HeroCard
          title="Your cohort"
          image={yourCohort}
          className="bg-neutral-50 md:absolute md:bottom-5 md:left-6 md:-rotate-18 lg:bottom-42 lg:left-0 lg:-rotate-7"
        >
          <p className="text-success-foreground mt-2 flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="bg-success-foreground size-2.5 rounded-full"
            />
            Available to chat
          </p>
        </HeroCard>

        <HeroCard
          title="Mentorship"
          image={mentorship}
          className="bg-lemon-100 md:absolute md:right-6 md:bottom-5 md:rotate-18 lg:right-0 lg:bottom-48 lg:rotate-7"
        >
          <p className="mt-2 text-sm text-neutral-700">
            Meet in a private room
          </p>
        </HeroCard>
      </div>
    </section>
  );
}
