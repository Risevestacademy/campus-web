import type { Icon } from "@phosphor-icons/react";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/ssr/CalendarCheck";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/ssr/ChatCircle";
import { ListChecksIcon } from "@phosphor-icons/react/dist/ssr/ListChecks";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr/MapTrifold";

import type { SidebarPanelId } from "../../store/shell-preferences";

export type RailPanelItem = {
  id: SidebarPanelId;
  label: string;
  Icon: Icon;
  badgeCount?: number;
};

export const railPanelItems: readonly RailPanelItem[] = [
  { id: "search", label: "Search", Icon: MagnifyingGlassIcon },
  { id: "map", label: "Campus overview", Icon: MapTrifoldIcon },
  { id: "chat", label: "Chat", Icon: ChatCircleIcon, badgeCount: 3 },
  { id: "tasks", label: "Tasks", Icon: ListChecksIcon },
  { id: "calendar", label: "Calendar", Icon: CalendarCheckIcon },
];
