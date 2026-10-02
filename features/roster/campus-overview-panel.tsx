"use client";

import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import { Input } from "@/shared/ui/input";
import { Kbd } from "@/shared/ui/kbd";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

import {
  mockActiveParticipants,
  mockOfflineParticipantCount,
} from "./mock-participants";
import {
  matchesParticipantFilter,
  type ParticipantFilterId,
  participantFilters,
} from "./participant-filters";
import { ParticipantRow } from "./participant-row";
import { QuickTransportList } from "./quick-transport-list";

const CURRENT_USER_CONTEXT_LABEL = "Product Design 2026 · Student";

const CARET_ICON_CLASSNAME =
  "-rotate-90 transition-transform group-data-panel-open/section:rotate-0";

export function CampusOverviewPanel({
  collapseButton,
}: {
  collapseButton: ReactNode;
}) {
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState<ParticipantFilterId>("all");

  const visibleParticipants = mockActiveParticipants.filter(
    (participant) =>
      matchesParticipantFilter(participant, activeFilter) &&
      participant.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-4 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-foreground text-xl font-semibold">
              Campus overview
            </h2>
            <p className="text-foreground-secondary mt-1 text-sm">
              {CURRENT_USER_CONTEXT_LABEL}
            </p>
          </div>
          {collapseButton}
        </div>

        <div className="relative mt-4">
          <MagnifyingGlassIcon
            aria-hidden
            size={16}
            className="text-icon-muted pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
          />
          <Input
            type="search"
            placeholder="Search participants"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="h-10 rounded-xl pl-8"
          />
          <Kbd className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2">
            Ctrl F
          </Kbd>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
        <ToggleGroup
          value={[activeFilter]}
          onValueChange={(next) => {
            if (next[0]) setActiveFilter(next[0] as ParticipantFilterId);
          }}
          className="flex-wrap gap-1.5"
        >
          {participantFilters.map((filter) => (
            <ToggleGroupItem
              key={filter.id}
              value={filter.id}
              variant="outline"
              className="data-pressed:text-primary-foreground dark:data-pressed:border-primary dark:data-pressed:bg-primary rounded-full data-pressed:border-[#152228] data-pressed:bg-[#152228]"
            >
              {filter.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Collapsible defaultOpen className="mt-4">
          <CollapsibleTrigger className="group/section text-foreground-secondary hover:text-foreground flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm">
            <CaretDownIcon
              aria-hidden
              size={14}
              className={CARET_ICON_CLASSNAME}
            />
            Online{" "}
            <span className="text-foreground-muted">
              {mockActiveParticipants.length}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul>
              {visibleParticipants.map((participant) => (
                <ParticipantRow
                  key={participant.id}
                  participant={participant}
                />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible>
          <CollapsibleTrigger className="group/section text-foreground-secondary hover:text-foreground flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm">
            <CaretDownIcon
              aria-hidden
              size={14}
              className={CARET_ICON_CLASSNAME}
            />
            Offline{" "}
            <span className="text-foreground-muted">
              {mockOfflineParticipantCount}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-foreground-muted px-2 py-2 text-sm">
              Offline participants will show up here.
            </p>
          </CollapsibleContent>
        </Collapsible>

        <div className="mt-6 border-t pt-4">
          <QuickTransportList />
        </div>
      </div>
    </div>
  );
}
