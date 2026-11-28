import type { Metadata } from "next";

import { PRIVATE_PAGE_ROBOTS } from "@/core/seo";

import { Providers } from "../providers";

export const metadata: Metadata = { robots: PRIVATE_PAGE_ROBOTS };

export default function CampusProvidersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
