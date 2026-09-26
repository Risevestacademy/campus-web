import Image from "next/image";

import brandEnvelope from "@/assets/landing-page/brand-envelope.svg";

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
      className="content-grid scroll-mt-22 bg-[#142429] py-16 font-sans text-neutral-50 md:scroll-mt-28 md:py-18"
    >
      <div className="mx-auto grid w-full max-w-[58.5rem] grid-cols-1 gap-12 md:grid-cols-2 md:items-center md:gap-16">
        <div>
          <p className="text-turquoise-300 text-[0.625rem] font-medium tracking-[0.12em] uppercase md:text-xs">
            How to join
          </p>
          <h2
            id="how-to-join-heading"
            className="font-display mt-4 max-w-[28rem] text-[2rem] leading-[1.12] font-semibold tracking-tight md:text-[2.375rem]"
          >
            <span className="block">Your invitation</span>
            <span className="block">is the starting point.</span>
          </h2>
          <p className="mt-5 max-w-[25rem] text-[0.8125rem] leading-5 text-neutral-200">
            No invitation yet? Contact your Rise programme admin.
          </p>

          <div aria-hidden="true" className="mt-5 h-20 w-28">
            <Image
              src={brandEnvelope}
              alt=""
              width={160}
              height={114}
              className="size-full object-contain"
            />
          </div>
        </div>

        <ol className="divide-y divide-neutral-50/15 border-y border-neutral-50/15">
          {onboardingSteps.map(({ number, title, description }) => (
            <li
              key={number}
              className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3.5 py-[1.125rem]"
            >
              <span className="text-turquoise-300 pt-0.5 text-xs leading-5 font-semibold tabular-nums">
                {number}
              </span>
              <div>
                <h3 className="font-display text-lg leading-6 font-semibold md:text-xl">
                  {title}
                </h3>
                <p className="mt-1.5 max-w-[25rem] text-[0.8125rem] leading-5 text-neutral-200">
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
