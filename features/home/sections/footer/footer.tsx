import Image from "next/image";
import Link from "next/link";

import inverseLogo from "@/assets/logo-inverse.svg";

const footerLinks = [
  { label: "Explore Campus", href: "#explore-campus" },
  { label: "How to join", href: "#how-to-join" },
  { label: "FAQs", href: "#faqs" },
  { label: "Sign in", href: "/sign-in" },
] as const;

export function FooterSection() {
  return (
    <footer
      className="content-grid bg-[#142429] font-sans text-neutral-50"
      style={{
        borderTop: "2px solid var(--color-turquoise-500)",
        paddingBlock: "2rem",
      }}
    >
      <div className="w-full">
        <div
          className="flex flex-col gap-6 md:flex-row md:items-center"
          style={{ justifyContent: "space-between" }}
        >
          <Link
            href="/"
            className="w-fit rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-50"
          >
            <Image
              src={inverseLogo}
              alt="Campus by Rise"
              width={181}
              height={53}
              className="h-auto w-32"
            />
          </Link>

          <nav
            aria-label="Footer"
            className="font-sans text-[0.6875rem] leading-4"
          >
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {footerLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-50"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div
          className="mt-8 flex flex-col gap-2 text-[0.625rem] leading-4 text-neutral-200 md:flex-row md:items-center"
          style={{ justifyContent: "space-between" }}
        >
          <p>A shared place to learn, connect and belong.</p>
          <p>© {new Date().getFullYear()} Campus by Rise.</p>
        </div>
      </div>
    </footer>
  );
}
