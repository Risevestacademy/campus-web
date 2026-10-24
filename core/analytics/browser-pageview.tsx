"use client";

import { usePathname } from "next/navigation";

import { useMountEffect } from "@/shared/lib/use-mount-effect";

import { captureBrowserPageview } from "./client";

// Render it after the page: React runs mount effects in tree order, so every
// effect the page queues (a reset, an identify, a cohort entry) comes first.
export function BrowserPageview() {
  const pathname = usePathname();
  return <CapturePageview key={pathname} pathname={pathname} />;
}

function CapturePageview({ pathname }: { pathname: string }) {
  useMountEffect(() => {
    captureBrowserPageview(pathname);
  });
  return null;
}
