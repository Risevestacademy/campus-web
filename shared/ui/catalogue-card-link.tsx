import { cn } from "cn";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";

import campusMap from "@/assets/landing-page/editable-spatial-illustration.svg";
import campusMapDark from "@/assets/landing-page/editable-spatial-illustration-dark.svg";

interface CatalogueCardLinkProps {
  href: Route;
  title: string;
  description?: string;
  className?: string;
  // Spacing for the caption alone, so a control beside it can claim room
  // without narrowing the picture above.
  captionClassName?: string;
}

// No campus map picture is published for a cohort yet, so every card shows
// the campus illustration. Both themes are in the page and CSS shows one.
export function CatalogueCardLink({
  href,
  title,
  description,
  className,
  captionClassName,
}: CatalogueCardLinkProps) {
  return (
    <Link href={href} className={cn("group w-fit", className)}>
      <figure
        data-surface-role="surface"
        className="bg-surface ring-border relative mb-2 block aspect-video w-[19.5rem] overflow-hidden rounded-2xl ring"
      >
        <Image
          src={campusMap}
          alt=""
          fill
          sizes="19.5rem"
          className="object-cover dark:hidden"
        />
        <Image
          src={campusMapDark}
          alt=""
          fill
          sizes="19.5rem"
          className="hidden object-cover dark:block"
        />
      </figure>
      <div className={captionClassName}>
        <h3 className="line-clamp-1 pl-2 font-medium group-hover:underline">
          {title}
        </h3>
        {description ? (
          <p className="text-foreground-secondary pl-2 text-sm">
            {description}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
