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
        "text-foreground-secondary hover:bg-surface-hover hover:text-foreground focus-visible:ring-ring/50 data-active:bg-surface-hover data-active:text-brand-foreground flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 data-active:font-semibold [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
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

// A pill-shaped list for a panel's header: the open tab is a filled pill, and
// a count may sit beside its name.
function TabsPillList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-pill-list"
      className={cn(
        "bg-surface-hover flex min-w-0 gap-0.5 rounded-full p-0.75",
        className,
      )}
      {...props}
    />
  );
}

function TabsPillTab({
  children,
  className,
  count,
  ...props
}: TabsPrimitive.Tab.Props & { count?: number }) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-pill-tab"
      className={cn(
        "text-foreground-secondary hover:text-foreground focus-visible:ring-ring/50 data-active:bg-surface-inverse data-active:text-foreground-inverse dark:data-active:bg-primary dark:data-active:text-primary-foreground relative flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.8125rem] leading-5 font-semibold whitespace-nowrap outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      {count === undefined ? null : (
        <span className="font-medium tabular-nums opacity-80">{count}</span>
      )}
    </TabsPrimitive.Tab>
  );
}

export { Tabs, TabsList, TabsPanel, TabsPillList, TabsPillTab, TabsTab };
