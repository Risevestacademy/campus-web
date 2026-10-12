"use client";

import { GaugeIcon } from "@phosphor-icons/react/dist/ssr/Gauge";
import { StackIcon } from "@phosphor-icons/react/dist/ssr/Stack";
import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cohortAdministrationHref } from "./cohort-administration-href";

function navigationItems(cohortId: string) {
  return [
    {
      href: cohortAdministrationHref(cohortId, "overview"),
      label: "Overview",
      Icon: GaugeIcon,
    },
    {
      href: cohortAdministrationHref(cohortId, "tracks"),
      label: "Programme Tracks",
      Icon: StackIcon,
    },
  ] as const;
}

export function AdminSidebar({
  cohortId,
  collapseButton,
}: {
  cohortId: string;
  collapseButton: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Administration"
      className="flex h-full flex-col p-3 py-4"
    >
      <header className="flex items-start justify-between gap-3 px-2">
        <div>
          <h2 className="text-xl font-semibold">Admin</h2>
        </div>
        {collapseButton}
      </header>

      <nav aria-label="Administration pages" className="mt-6 grid gap-1">
        {navigationItems(cohortId).map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={cn(
              "text-foreground-secondary hover:text-foreground flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors duration-150 hover:bg-[#E9ECF6] dark:hover:bg-[#2B3B5F]",
              "aria-[current=page]:text-primary aria-[current=page]:bg-[#E9ECF6] dark:aria-[current=page]:bg-[#2B3B5F] dark:aria-[current=page]:text-[#F7F7F7]",
            )}
          >
            <Icon aria-hidden size={18} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
