// Round controls stacked in the bottom-left corner; the Presence Dock owns the
// row beside them. Hidden wherever a page hosts its own copies
// (data-theme-toggle-host, such as the campus rail).
export const floatingControlClassName =
  "bg-surface border-border text-icon hover:bg-surface-hover active:bg-surface-pressed focus-visible:ring-border-focus focus-visible:ring-offset-background fixed left-3 grid size-10 cursor-pointer place-items-center rounded-full border shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 [:root:has([data-theme-toggle-host])_&]:hidden";
