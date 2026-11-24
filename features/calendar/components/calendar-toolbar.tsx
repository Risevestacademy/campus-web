"use client";

import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";

import { Button } from "@/shared/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

import type { CalendarView } from "../services/calendar-window";

const VIEWS: readonly { value: CalendarView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

// Today, back and forward, the range's title and the Day, Week and Month
// switch.
export function CalendarToolbar({
  title,
  view,
  onToday,
  onStep,
  onView,
}: Readonly<{
  title: string;
  view: CalendarView;
  onToday: () => void;
  onStep: (direction: 1 | -1) => void;
  onView: (view: CalendarView) => void;
}>) {
  const unit = view === "month" ? "month" : view;

  return (
    <div className="border-shell-line flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
      <Button variant="outline" size="sm" onClick={onToday}>
        Today
      </Button>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Previous ${unit}`}
          onClick={() => onStep(-1)}
        >
          <CaretLeftIcon aria-hidden size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Next ${unit}`}
          onClick={() => onStep(1)}
        >
          <CaretRightIcon aria-hidden size={16} />
        </Button>
      </div>
      <h2 className="font-display min-w-0 flex-1 truncate text-lg font-semibold">
        {title}
      </h2>
      <ToggleGroup
        aria-label="Calendar view"
        value={[view]}
        onValueChange={(next) => {
          const chosen = VIEWS.find((item) => item.value === next[0]);
          if (chosen) onView(chosen.value);
        }}
        variant="outline"
        spacing={0}
      >
        {VIEWS.map(({ value, label }) => (
          <ToggleGroupItem key={value} value={value}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
