"use client";

const listeners = new Set<() => void>();
let isOpen = false;

function setOpen(next: boolean): void {
  if (isOpen === next) return;

  isOpen = next;
  listeners.forEach((listener) => listener());
}

export function getFeedbackPanelOpenSnapshot(): boolean {
  return isOpen;
}

export function getServerFeedbackPanelOpenSnapshot(): boolean {
  return false;
}

export function openFeedbackPanel(): void {
  setOpen(true);
}

export function closeFeedbackPanel(): void {
  setOpen(false);
}

export function subscribeToFeedbackPanel(
  onStoreChange: () => void,
): () => void {
  listeners.add(onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
  };
}
