import brandEnvelope from "@/assets/landing-page/brand-envelope.svg";
import brandEnvelopeDark from "@/assets/landing-page/brand-envelope-dark.svg";

import { ThemedImage } from "../themed-image";

const onboardingSteps = [
  {
    number: "01",
    title: "Open your invitation",
    description:
      "Your Rise admin sends a link with your role, cohort and track already attached.",
  },
  {
    number: "02",
    title: "Make yourself at home",
    description:
      "Accept your invitation and complete your profile and onboarding.",
  },
  {
    number: "03",
    title: "Come back with Google",
    description: "Once you’re set up, sign in with Google to return to Campus.",
  },
];

export function HowToJoinSection() {
  return (
    <section
      id="how-to-join"
      aria-labelledby="how-to-join-heading"
      className="content-grid scroll-mt-22 bg-[#142429] py-24 font-sans text-neutral-50 md:scroll-mt-28 dark:bg-[linear-gradient(to_right,#162350_15%,#2442b0_57%,#162350_100%)]"
    >
      <div className="grid w-full grid-cols-1 gap-12 md:grid-cols-2 md:items-center md:gap-24">
        <div>
          <p className="text-turquoise-300 dark:text-accent text-[13px] leading-5 font-semibold tracking-[0.1em] uppercase">
            How to join
          </p>

          <h2
            id="how-to-join-heading"
            className="font-display mt-4 max-w-[592px] text-[56px] leading-[60px] font-semibold tracking-[-0.02em]"
          >
            <span className="block">Your invitation</span>
            <span className="block">is the starting point.</span>
          </h2>

          <p className="mt-6 max-w-[390px] text-[17px] leading-[27px] text-neutral-200 dark:text-neutral-50">
            No invitation yet? Contact your Rise programme admin.
          </p>

          <div aria-hidden="true" className="mt-6 h-[114px] w-[160px]">
            <ThemedImage
              light={brandEnvelope}
              dark={brandEnvelopeDark}
              alt=""
              width={160}
              height={114}
              className="size-full object-contain"
            />
          </div>
        </div>

        <ol className="dark:divide-cobalt-400/90 dark:border-cobalt-400/90 divide-y divide-neutral-50/15 border-y border-neutral-50/15">
          {onboardingSteps.map(({ number, title, description }) => (
            <li
              key={number}
              className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-5 py-[26px]"
            >
              <span className="text-turquoise-300 dark:text-accent pt-0.5 text-base leading-7 font-semibold tabular-nums">
                {number}
              </span>

              <div>
                <h3 className="font-display text-[27px] leading-8 font-semibold">
                  {title}
                </h3>

                <p className="mt-2.5 max-w-[540px] text-base leading-[160%] text-neutral-200 dark:text-neutral-50">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
