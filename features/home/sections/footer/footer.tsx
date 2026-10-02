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
    <footer className="content-grid relative bg-[#142429] py-12 font-sans text-neutral-50">
      <div
        aria-hidden="true"
        className="full-width bg-turquoise-500 pointer-events-none absolute inset-x-0 top-0 h-0.5"
      />

      <div className="flex w-full flex-col gap-11">
        <div className="flex min-h-[52.5476px] flex-col justify-between gap-6 md:flex-row md:items-center">
          <Link
            href="/"
            className="w-fit rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-50"
          >
            <Image
              src={inverseLogo}
              alt="Campus by Rise"
              width={181}
              height={53}
              className="h-auto w-[180.0707px] rounded-[1.06px]"
            />
          </Link>

          <nav aria-label="Footer" className="w-96 max-w-full font-sans">
            <ul className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[15px] leading-6 font-medium">
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

        <div className="flex w-full flex-col justify-between gap-2 text-neutral-200 md:flex-row md:items-center">
          <p className="w-[430px] max-w-full text-[15px] leading-6 font-normal">
            A shared place to learn, connect and belong.
          </p>

          <p className="w-[180px] max-w-full text-[13px] leading-6 font-normal">
            © {new Date().getFullYear()} Campus by Rise.
          </p>
        </div>
      </div>
    </footer>
  );
}
