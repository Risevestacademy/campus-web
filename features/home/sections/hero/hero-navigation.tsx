import Image from "next/image";
import Link from "next/link";

import logo from "@/assets/logo-inverse.svg";

const links = [
  { label: "Explore Campus", href: "#explore-campus" },
  { label: "How to join", href: "#how-to-join" },
  { label: "FAQs", href: "#faqs" },
] as const;

export function HeroNavigation() {
  return (
    <header className="flex items-center justify-between gap-6 py-6 md:py-8">
      <Link
        href="/"
        className="outline-background rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <Image
          src={logo}
          alt="Campus by Rise"
          className="h-auto w-28 md:w-44"
        />
      </Link>

      <nav aria-label="Primary" className="hidden md:block">
        <ul className="flex items-center gap-4 text-lg lg:gap-8">
          {links.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                className="outline-background rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Link
        href="/campus"
        className="bg-background text-primary hover:bg-surface-hover active:bg-surface-pressed outline-background inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 md:h-12 md:px-5 md:text-base"
      >
        Enter Campus
      </Link>
    </header>
  );
}
