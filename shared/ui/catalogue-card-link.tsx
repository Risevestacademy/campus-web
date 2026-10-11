import { cn } from "cn";
import type { Route } from "next";
import Link from "next/link";

interface CatalogueCardLinkProps {
  href: string;
  title: string;
  description?: string;
  className?: string;
}

export function CatalogueCardLink({
  href,
  title,
  description,
  className,
}: CatalogueCardLinkProps) {
  return (
    <Link href={href as Route} className={cn("group w-fit", className)}>
      <figure className="bg-surface ring-border mb-2 block aspect-video w-80 rounded-2xl ring"></figure>
      <h3 className="line-clamp-1 pl-2 font-medium group-hover:underline">
        {title}
      </h3>
      {description === undefined ? null : (
        <p className="text-foreground-secondary pl-2 text-sm">{description}</p>
      )}
    </Link>
  );
}
