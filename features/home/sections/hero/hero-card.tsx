import { cn } from "cn";
import { type StaticImageData } from "next/image";
import type { ReactNode } from "react";

import { ThemedImage } from "@/shared/ui/themed-image";

type HeroCardProps = {
  title: string;
  image: StaticImageData;
  darkImage?: StaticImageData;
  className?: string;
  children: ReactNode;
};

export function HeroCard({
  title,
  image,
  darkImage,
  className,
  children,
}: HeroCardProps) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl p-3 text-neutral-950 shadow-lg md:w-44 xl:w-60 dark:text-neutral-50",
        className,
      )}
    >
      <ThemedImage
        light={image}
        dark={darkImage}
        alt=""
        className="h-auto w-full"
      />
      <p className="font-display mt-3 text-xl font-semibold">{title}</p>
      {children}
    </div>
  );
}
