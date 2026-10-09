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
          <p className="text-foreground-secondary mt-1 text-sm">
            Campus administration
          </p>
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
              "text-foreground-secondary hover:bg-accent hover:text-foreground flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors duration-150",
              "aria-[current=page]:bg-cobalt-500/10 aria-[current=page]:text-primary",
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
