import type { ReactNode } from "react";

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border-border text-foreground-secondary rounded-3xl border p-6 dark:border-[#2B3B5F]"
    >
      {children}
    </p>
  );
}
