"use client";

import { cn } from "cn";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { useActivePanel, useSidebarOpen } from "../../hooks/use-sidebar-state";
import type { SidebarPanelId } from "../../store/sidebar-preferences";

const SIDEBAR_WIDTH = 312;
const SIDEBAR_TRANSITION = {
  type: "spring",
  stiffness: 420,
  damping: 42,
} as const;
const SIDEBAR_CONTENT_TRANSITION = {
  duration: 0.2,
  ease: "easeInOut",
} as const;

type CampusSidebarProps = {
  panels: Record<SidebarPanelId, ReactNode>;
};

export function CampusSidebar({ panels }: CampusSidebarProps) {
  const isOpen = useSidebarOpen();
  const activePanel = useActivePanel();

  return (
    <motion.div
      data-slot="campus-sidebar"
      initial={false}
      animate={{ width: isOpen ? SIDEBAR_WIDTH : 0 }}
      transition={SIDEBAR_TRANSITION}
      className="bg-background shrink-0 overflow-hidden rounded-xl border border-[#D3DAE9] dark:border-[#2B3B5F] dark:bg-[#1F2940]"
    >
      <motion.div
        initial={false}
        animate={{ opacity: isOpen ? 1 : 0 }}
        transition={SIDEBAR_CONTENT_TRANSITION}
        style={{ width: SIDEBAR_WIDTH }}
        className={cn("flex h-full flex-col", !isOpen && "pointer-events-none")}
      >
        {panels[activePanel]}
      </motion.div>
    </motion.div>
  );
}
