import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type HeroCardProps = {
  title: string;
  image: StaticImageData;
  className?: string;
  children: ReactNode;
};

export function HeroCard({ title, image, className, children }: HeroCardProps) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl p-3 text-neutral-950 shadow-lg md:w-44 xl:w-60",
        className,
      )}
    >
      <Image src={image} alt="" className="h-auto w-full" />
      <p className="font-display mt-3 text-xl font-semibold">{title}</p>
      {children}
    </div>
  );
}
