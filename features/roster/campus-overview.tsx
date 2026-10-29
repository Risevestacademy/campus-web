"use client";

import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

import { useMountEffect } from "@/shared/lib/use-mount-effect";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import { Input } from "@/shared/ui/input";
import { Kbd } from "@/shared/ui/kbd";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

import {
  matchesParticipantFilter,
  type ParticipantFilterId,
  participantFilters,
} from "./participant-filters";
import { ParticipantRow } from "./participant-row";
import type { QuickTransportDestination } from "./quick-transport";
import { QuickTransportList } from "./quick-transport-list";
import type { Participant, ParticipantAction } from "./types";

const CARET_ICON_CLASSNAME =
  "-rotate-90 transition-transform group-data-panel-open/section:rotate-0";

const isFindShortcut = (event: KeyboardEvent) =>
  event.ctrlKey &&
  !event.metaKey &&
  !event.altKey &&
  !event.shiftKey &&
  event.key.toLowerCase() === "f";

// Behind a modal or faded out with a collapsed sidebar, the search cannot take
// focus, and swallowing the shortcut would only cost the browser's own find.
function canTakeFocus(search: HTMLInputElement) {
  return (
    !search.closest('[aria-hidden="true"], [inert]') &&
    search.checkVisibility?.({
      opacityProperty: true,
      visibilityProperty: true,
    }) !== false
  );
}

export type CampusOverviewProps = Readonly<{
  collapseButton: ReactNode;
  contextLabel: string;
  offlineParticipants?: readonly Participant[];
  onParticipantAction?: (
    action: ParticipantAction,
    participant: Participant,
  ) => void;
  onQuickTransport?: (destination: QuickTransportDestination) => void;
  participants: readonly Participant[];
}>;

export function CampusOverview({
  collapseButton,
  contextLabel,
  offlineParticipants,
  onParticipantAction,
  onQuickTransport,
  participants,
}: CampusOverviewProps) {
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState<ParticipantFilterId>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  // On the window in the capture phase, so the browser's find never sees it.
  useMountEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const search = searchRef.current;
      if (!search || !isFindShortcut(event) || !canTakeFocus(search)) return;
      event.preventDefault();
      search.focus();
      search.select();
    }

    window.addEventListener("keydown", focusSearch, { capture: true });
    return () =>
      window.removeEventListener("keydown", focusSearch, { capture: true });
  });

  const matchesSearch = (participant: Participant) =>
    participant.name.toLowerCase().includes(searchText.toLowerCase());
  const visibleParticipants = participants.filter(
    (participant) =>
      matchesParticipantFilter(participant, activeFilter) &&
      matchesSearch(participant),
  );
  const visibleOfflineParticipants = offlineParticipants?.filter(
    (participant) =>
      matchesParticipantFilter(participant, activeFilter) &&
      matchesSearch(participant),
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
              {contextLabel}
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
            ref={searchRef}
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
            <span className="text-foreground-muted">{participants.length}</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul>
              {visibleParticipants.map((participant) => (
                <ParticipantRow
                  key={participant.id}
                  onAction={onParticipantAction}
                  participant={participant}
                />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>

        {offlineParticipants && (
          <Collapsible>
            <CollapsibleTrigger className="group/section text-foreground-secondary hover:text-foreground flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm">
              <CaretDownIcon
                aria-hidden
                size={14}
                className={CARET_ICON_CLASSNAME}
              />
              Offline{" "}
              <span className="text-foreground-muted">
                {offlineParticipants.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul>
                {visibleOfflineParticipants?.map((participant) => (
                  <ParticipantRow
                    key={participant.id}
                    participant={participant}
                  />
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="mt-6 border-t pt-4">
          <QuickTransportList onSelect={onQuickTransport} />
        </div>
      </div>
    </div>
  );
}
