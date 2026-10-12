"use client";

import {
  type ComponentType,
  type ReactNode,
  type RefObject,
  useRef,
  useSyncExternalStore,
} from "react";

import {
  closeFeedbackPanel,
  getFeedbackPanelOpenSnapshot,
  getServerFeedbackPanelOpenSnapshot,
  subscribeToFeedbackPanel,
} from "../../store/feedback-panel-store";

export type FeedbackPopupComponent = ComponentType<{
  isOpen: boolean;
  onClose: () => void;
  container: RefObject<HTMLElement | null>;
  userName?: string | null;
}>;

export function FeedbackLayer({
  FeedbackPopup,
  userName,
  children,
}: {
  FeedbackPopup?: FeedbackPopupComponent;
  userName?: string | null;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isOpen = useSyncExternalStore(
    subscribeToFeedbackPanel,
    getFeedbackPanelOpenSnapshot,
    getServerFeedbackPanelOpenSnapshot,
  );

  return (
    <div ref={containerRef} className="relative flex min-w-0 flex-1">
      {children}
      {FeedbackPopup ? (
        <FeedbackPopup
          isOpen={isOpen}
          onClose={closeFeedbackPanel}
          container={containerRef}
          userName={userName}
        />
      ) : null}
    </div>
  );
}
