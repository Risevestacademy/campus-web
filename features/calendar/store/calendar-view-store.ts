"use client";

import { useSyncExternalStore } from "react";

import {
  type CalendarView,
  startOfDay,
  stepAnchor,
} from "../services/calendar-window";

export type CalendarFilters = Readonly<{ campus: boolean; busy: boolean }>;

// What the panel and the main area share: which days are shown, how, and which
// kinds of event. Nothing of it is saved: a reload opens on this week.
export type CalendarViewState = Readonly<{
  view: CalendarView;
  // The day the range is built around. Null is today, so a page left open
  // overnight and then reset still lands on the day it is.
  anchor: number | null;
  filters: CalendarFilters;
}>;

const INITIAL: CalendarViewState = {
  view: "week",
  anchor: null,
  filters: { campus: true, busy: true },
};

let state: CalendarViewState = INITIAL;
const listeners = new Set<() => void>();

function update(next: CalendarViewState): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCalendarView(): CalendarViewState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}

export function anchorOf(current: CalendarViewState, now: Date): Date {
  return current.anchor === null ? startOfDay(now) : new Date(current.anchor);
}

export function setCalendarView(view: CalendarView): void {
  update({ ...state, view });
}

export function showCalendarDay(day: Date): void {
  update({ ...state, anchor: startOfDay(day).getTime() });
}

// A day opened from the month: that day, in the Day view.
export function openCalendarDay(day: Date): void {
  update({ ...state, view: "day", anchor: startOfDay(day).getTime() });
}

export function showToday(): void {
  update({ ...state, anchor: null });
}

export function stepCalendar(direction: 1 | -1, now: Date): void {
  update({
    ...state,
    anchor: stepAnchor(state.view, anchorOf(state, now), direction).getTime(),
  });
}

export function toggleCalendarFilter(name: keyof CalendarFilters): void {
  update({
    ...state,
    filters: { ...state.filters, [name]: !state.filters[name] },
  });
}

export function resetCalendarView(): void {
  update(INITIAL);
}
