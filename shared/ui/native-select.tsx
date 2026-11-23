import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { cn } from "cn";
import type { ComponentProps } from "react";

// The browser's own select, styled like Input: its options open in the
// platform's picker, which reads well on phones and with assistive tech.
function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <div data-slot="native-select-wrapper" className="relative w-full">
      <select
        data-slot="native-select"
        className={cn(
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 h-11 w-full min-w-0 appearance-none truncate rounded-lg border bg-transparent py-1 pr-9 pl-3 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
          className,
        )}
        {...props}
      />
      <CaretDownIcon
        aria-hidden
        weight="bold"
        className="text-icon pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      />
    </div>
  );
}

export { NativeSelect };
