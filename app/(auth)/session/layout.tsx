import type { Metadata } from "next";

import { PRIVATE_PAGE_ROBOTS } from "@/core/seo";

export const metadata: Metadata = { robots: PRIVATE_PAGE_ROBOTS };

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-surface-role="background" className="bg-background grid h-dvh">
      <main
        className="content-grid content-center items-center"
        style={{ "--content-max-width": "37rem" } as React.CSSProperties}
      >
        {children}
      </main>
    </div>
  );
}
