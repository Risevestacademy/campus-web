"use client";

import { Checkbox } from "@/shared/ui/checkbox";

import {
  type CalendarFilters as Filters,
  toggleCalendarFilter,
} from "../store/calendar-view-store";

const FILTERS: readonly { name: keyof Filters; label: string }[] = [
  { name: "campus", label: "Campus events" },
  { name: "busy", label: "Busy from Google" },
];

// Which kinds of event the grid and the Today list show.
export function CalendarFilters({ filters }: Readonly<{ filters: Filters }>) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-foreground-secondary mb-1 text-xs font-medium">
        Calendars
      </legend>
      {FILTERS.map(({ name, label }) => (
        <label
          key={name}
          className="flex cursor-pointer items-center gap-2 text-sm"
        >
          <Checkbox
            checked={filters[name]}
            onCheckedChange={() => toggleCalendarFilter(name)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
