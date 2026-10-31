import Image from "next/image";
import Link from "next/link";

import logo from "@/assets/logo-inverse.svg";

import { HeroMobileMenu } from "./hero-mobile-menu";
import { enterCampusHref, navigationLinks } from "./navigation-links";

export function HeroNavigation() {
  return (
    <header className="bg-primary text-primary-foreground fixed inset-x-0 top-0 z-30">
      <div className="relative mx-auto flex h-(--hero-nav-height) w-[calc(100%-2rem)] max-w-7xl items-center justify-between gap-6">
        <Link
          href="/"
          className="outline-primary-foreground rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Image
            src={logo}
            alt="Campus by Rise"
            className="h-auto w-28 md:w-44"
          />
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-4 text-lg lg:gap-8">
            {navigationLinks.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="outline-primary-foreground rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={enterCampusHref}
            className="bg-primary-foreground text-primary hover:bg-cobalt-100 active:bg-cobalt-200 outline-primary-foreground hidden h-10 items-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 md:inline-flex md:h-12 md:px-5 md:text-base"
          >
            Enter Campus
          </Link>
          <HeroMobileMenu />
        </div>
      </div>
    </header>
  );
}
