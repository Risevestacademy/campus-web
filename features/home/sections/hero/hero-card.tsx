import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type HeroCardProps = {
  title: string;
  mediaClassName: string;
  className?: string;
  children: ReactNode;
};

export function HeroCard({
  title,
  mediaClassName,
  className,
  children,
}: HeroCardProps) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl p-3 text-neutral-950 shadow-lg md:w-44 lg:w-52 xl:w-60",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn("aspect-4/3 rounded-xl", mediaClassName)}
      />
      <p className="font-display mt-3 text-xl font-semibold">{title}</p>
      {children}
    </div>
  );
}
