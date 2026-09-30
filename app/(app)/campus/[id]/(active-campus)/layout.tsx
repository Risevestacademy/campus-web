import Link from "next/link";
import Script from "next/script";
import type { ReactNode } from "react";

import {
  CampusRail,
  CampusSidebar,
  railPanelItems,
  shellInitializerScript,
  SidebarCollapseButton,
  SidebarComingSoonPanel,
  SidebarReopenToggle,
} from "@/features/campus-shell";
import { CampusOverviewPanel } from "@/features/roster";

const collapseButton = <SidebarCollapseButton />;

const comingSoonPanels = Object.fromEntries(
  railPanelItems
    .filter((item) => item.id !== "map")
    .map((item) => [
      item.id,
      <SidebarComingSoonPanel
        key={item.id}
        title={item.label}
        Icon={item.Icon}
        collapseButton={collapseButton}
      />,
    ]),
) as Record<Exclude<(typeof railPanelItems)[number]["id"], "map">, ReactNode>;

export default function ActiveCampusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      data-surface-role="background"
      className="bg-background text-foreground flex h-dvh gap-1.5 p-1.5"
    >
      <Script id="campus-shell-initializer" strategy="beforeInteractive">
        {shellInitializerScript}
      </Script>

      <CampusRail />
      <CampusSidebar
        panels={{
          ...comingSoonPanels,
          map: <CampusOverviewPanel collapseButton={collapseButton} />,
        }}
      />

      <div className="flex flex-1">
        <div
          data-surface-role="surface"
          className="bg-surface grid flex-1 grid-rows-[auto_1fr_auto] rounded-xl"
        >
          <div className="relative">
            <div className="absolute top-3 left-3 z-10">
              <SidebarReopenToggle />
            </div>
            <aside
              id="top-actions"
              className="absolute inset-x-0 top-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 p-1.5"
            >
              {/* top actions */}
              <div className="flex h-fit items-center gap-3">
                <button
                  data-surface-role="surface-elevated"
                  className="bg-surface-elevated border-border size-10 rounded-xl border"
                ></button>

                <div className="flex items-center gap-1.5">
                  <div className="flex">
                    <figure className="bg-surface-elevated border-border size-8 rounded-full border"></figure>
                    <figure className="bg-surface-elevated border-border -ml-2 size-8 rounded-full border"></figure>
                  </div>
                  <h2 className="text-sm font-medium">Title for meeting</h2>
                </div>

                <button className="bg-surface-elevated border-border size-10 rounded-xl border"></button>
              </div>

              <div
                data-surface-role="background"
                className="bg-background mx-auto flex w-fit flex-col rounded-[1.125rem] p-1.5"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <figure className="bg-surface aspect-video w-60 rounded-xl"></figure>
                  <figure className="bg-surface aspect-video w-60 rounded-xl"></figure>
                </div>
                <p className="px-2 pt-1.5 pb-1 text-center text-sm">
                  Description for meeting
                </p>
              </div>

              <div className="mr-12 justify-self-end">
                <button className="bg-surface-elevated border-border size-10 rounded-xl border"></button>
              </div>
            </aside>
          </div>

          {children}

          <div className="relative">
            <aside
              id="bottom-actions"
              data-layout-anchor="campus-controls"
              className="absolute inset-x-0 bottom-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center p-1.5 px-3"
            >
              {/* bottom actions */}
              <div className="bg-background col-start-2 flex items-center gap-1.5 rounded-[1.125rem] p-1.5 px-3">
                <button className="bg-surface size-10 rounded-xl"></button>
                <div className="bg-border mx-1.5 h-6 w-px"></div>

                <button className="bg-surface size-10 w-12 rounded-xl"></button>
                <button className="bg-surface size-10 w-12 rounded-xl"></button>
                <button className="bg-surface size-10 rounded-xl"></button>
                <button className="bg-surface size-10 rounded-xl"></button>
                <button className="bg-surface size-10 rounded-xl"></button>

                <div className="bg-border mx-1.5 h-6 w-px"></div>
                <Link
                  href={"/campus"}
                  className="bg-surface size-10 rounded-xl"
                ></Link>
              </div>

              <div className="ml-auto flex gap-3">
                <button className="bg-surface-elevated border-border size-10 rounded-xl border"></button>
                <button className="bg-surface-elevated border-border size-10 rounded-xl border"></button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
