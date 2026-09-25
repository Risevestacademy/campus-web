"use client";

import { ListIcon } from "@phosphor-icons/react/dist/ssr/List";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import Link from "next/link";
import { type KeyboardEvent, useRef, useState } from "react";

import { enterCampusHref, navigationLinks } from "./navigation-links";

export function HeroMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const buttonReference = useRef<HTMLButtonElement>(null);

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key !== "Escape" || !isOpen) return;

    setIsOpen(false);
    buttonReference.current?.focus();
  }

  return (
    <div className="md:hidden" onKeyDown={closeOnEscape}>
      <button
        ref={buttonReference}
        type="button"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        aria-controls="hero-mobile-menu"
        onClick={() => setIsOpen(!isOpen)}
        className="hover:bg-primary-hover active:bg-primary-active outline-background grid size-10 cursor-pointer place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {isOpen ? (
          <XIcon aria-hidden size={24} weight="regular" />
        ) : (
          <ListIcon aria-hidden size={24} weight="regular" />
        )}
      </button>

      {isOpen && (
        <nav
          id="hero-mobile-menu"
          aria-label="Primary"
          className="absolute top-full right-0 z-20 mt-2 w-[40vw] min-w-40 rounded-2xl bg-neutral-950/70 p-2 text-neutral-50 shadow-lg backdrop-blur-md"
        >
          <ul>
            {navigationLinks.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setIsOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base outline-neutral-50 hover:bg-neutral-50/15 focus-visible:outline-2 active:bg-neutral-50/25"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={enterCampusHref}
            onClick={() => setIsOpen(false)}
            className="bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active mt-2 block rounded-lg px-3 py-3 text-center text-base font-medium outline-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Enter Campus
          </Link>
        </nav>
      )}
    </div>
  );
}
