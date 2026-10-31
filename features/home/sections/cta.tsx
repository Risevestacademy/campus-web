import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import Image from "next/image";
import Link from "next/link";

import campusMark from "@/assets/icon-lemon.svg";

export function CTASection() {
  return (
    <section
      id="cta"
      aria-labelledby="cta-heading"
      className="content-grid bg-primary text-primary-foreground py-24 font-sans dark:bg-[radial-gradient(ellipse_52%_38%_at_50%_49%,rgb(49_85_214/0.5),transparent),linear-gradient(to_bottom,#2443b2,#162452)]"
    >
      <div className="grid w-full grid-cols-1 items-center gap-16 md:grid-cols-[minmax(0,1fr)_270px]">
        <div>
          <h2
            id="cta-heading"
            className="font-display max-w-[946px] text-5xl leading-[1.05] font-bold tracking-[-0.03em] sm:text-6xl lg:text-[88px] lg:leading-[88px]"
          >
            <span className="block">See you on</span>
            <span className="block">Campus.</span>
          </h2>

          <p className="text-primary-foreground/90 mt-6 max-w-[620px] text-[17px] leading-[160%]">
            Your classes, your conversations and your community have a place to
            meet. Sign in and find your way back to your cohort.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/campus"
              className="bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active focus-visible:outline-primary-foreground inline-flex h-14 items-center gap-2 rounded-lg px-5 text-base leading-6 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Enter Campus
              <ArrowUpRightIcon aria-hidden size={20} weight="regular" />
            </Link>

            <Link
              href="/invitation"
              className="outline-primary-foreground inline-flex items-center gap-2 rounded-sm text-base leading-6 font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              Have an invitation?
              <ArrowUpRightIcon aria-hidden size={16} weight="regular" />
            </Link>
          </div>

          <p className="text-primary-foreground/80 mt-4 max-w-[600px] text-[13px] leading-[21px]">
            Campus is invite-only. New members should start with their
            invitation link.
          </p>
        </div>

        <Image
          src={campusMark}
          alt=""
          aria-hidden="true"
          width={270}
          height={309}
          className="h-auto w-[270px] justify-self-center"
        />
      </div>
    </section>
  );
}
