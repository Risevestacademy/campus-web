import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import Image from "next/image";
import Link from "next/link";

import campusMark from "@/assets/icon-lemon.svg";

export function CTASection() {
  return (
    <section
      id="cta"
      aria-labelledby="cta-heading"
      className="content-grid bg-primary text-primary-foreground py-16 font-sans md:py-20"
    >
      <div className="mx-auto grid w-full max-w-[58.5rem] grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,1fr)_14rem] md:gap-12">
        <div>
          <h2
            id="cta-heading"
            className="font-display max-w-[30rem] text-[2.75rem] leading-[1.02] font-semibold tracking-tight md:text-[3.5rem]"
          >
            <span className="block">See you on</span>
            <span className="block">Campus.</span>
          </h2>

          <p className="text-background/90 mt-5 max-w-[29rem] text-[0.8125rem] leading-5">
            Your classes, your conversations and your community have a place to
            meet. Sign in and find your way back to your cohort.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/campus"
              className="bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active focus-visible:outline-background inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Enter Campus
              <ArrowUpRightIcon aria-hidden size={14} weight="regular" />
            </Link>
            <Link
              href="/invitation"
              className="outline-background inline-flex items-center gap-1.5 rounded-sm text-xs font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              Have an invitation?
              <ArrowUpRightIcon aria-hidden size={12} weight="regular" />
            </Link>
          </div>

          <p className="text-background/80 mt-4 max-w-[30rem] text-[0.625rem] leading-4">
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
          className="h-auto w-32 justify-self-center md:w-40"
        />
      </div>
    </section>
  );
}
