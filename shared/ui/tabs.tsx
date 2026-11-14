"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "cn";

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn(
        "flex gap-4 data-[orientation=horizontal]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex gap-1 data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "text-foreground hover:bg-surface-hover focus-visible:ring-ring aria-selected:bg-cobalt-100 aria-selected:text-cobalt-700 dark:aria-selected:bg-cobalt-900 dark:aria-selected:text-cobalt-200 flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-left text-[0.9375rem] font-medium outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-selected:font-semibold [&_svg]:size-4.5 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn("min-w-0 flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsPanel, TabsTab };
