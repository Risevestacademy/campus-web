import "server-only";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { buttonVariants } from "@/shared/ui/button";

type LinkHref = ComponentProps<typeof Link>["href"];

export function CataloguePagination({
  ariaLabel,
  hrefForPage,
  page,
  totalPages,
}: {
  ariaLabel: string;
  hrefForPage: (page: number) => LinkHref;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label={ariaLabel} className="flex items-center gap-4">
      {page > 1 ? (
        <Link
          href={hrefForPage(page - 1)}
          className={buttonVariants({ variant: "outline" })}
        >
          Previous page
        </Link>
      ) : null}
      <span className="text-foreground-secondary text-sm">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={hrefForPage(page + 1)}
          className={buttonVariants({ variant: "outline" })}
        >
          Next page
        </Link>
      ) : null}
    </nav>
  );
}

export function CatalogueUnavailable({
  children,
  retryHref,
}: {
  children: ReactNode;
  retryHref: LinkHref;
}) {
  return (
    <div className="grid justify-items-start gap-4">
      <p role="alert">{children}</p>
      <Link href={retryHref} className={buttonVariants({ variant: "outline" })}>
        Try again
      </Link>
    </div>
  );
}
