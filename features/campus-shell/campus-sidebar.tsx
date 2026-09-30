"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

import type { SidebarPanelId } from "./shell-preferences";
import {
  getActivePanelSnapshot,
  getServerActivePanelSnapshot,
  getServerSidebarOpenSnapshot,
  getSidebarOpenSnapshot,
  subscribeToShell,
} from "./shell-store";

const SIDEBAR_WIDTH = 312;
const SIDEBAR_TRANSITION = {
  type: "spring",
  stiffness: 420,
  damping: 42,
} as const;

type CampusSidebarProps = {
  panels: Record<SidebarPanelId, ReactNode>;
};

export function CampusSidebar({ panels }: CampusSidebarProps) {
  const isOpen = useSyncExternalStore(
    subscribeToShell,
    getSidebarOpenSnapshot,
    getServerSidebarOpenSnapshot,
  );
  const activePanel = useSyncExternalStore(
    subscribeToShell,
    getActivePanelSnapshot,
    getServerActivePanelSnapshot,
  );

  return (
    <motion.div
      data-slot="campus-sidebar"
      initial={false}
      animate={{ width: isOpen ? SIDEBAR_WIDTH : 0 }}
      transition={SIDEBAR_TRANSITION}
      className="bg-background shrink-0 overflow-hidden rounded-xl border border-[#D3DAE9] dark:border-[#2B3B5F] dark:bg-[#1F2940]"
    >
      {/* A fixed width, rather than max-w-full, keeps the content from
          reflowing while the sidebar animates open and closed; the wrapper
          above clips it instead. */}
      <div style={{ width: SIDEBAR_WIDTH }} className="flex h-full flex-col">
        {panels[activePanel]}
      </div>
    </motion.div>
  );
}
