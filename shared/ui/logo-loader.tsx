import { cn } from "cn";
import type { SVGProps } from "react";

import { CampusLogo } from "@/assets/svgs/logo";

import styles from "./logo-loader.module.css";

// The 300ms delay keeps a load that settles quickly from flashing the mark,
// so reduced motion zeroes the fade instead of removing the delayed hold.
export function LogoLoader({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <CampusLogo
      aria-hidden
      className={cn(
        "text-primary animate-in fade-in fill-mode-both delay-300 duration-200 motion-reduce:duration-0",
        styles.chase,
        className,
      )}
      {...props}
    />
  );
}
