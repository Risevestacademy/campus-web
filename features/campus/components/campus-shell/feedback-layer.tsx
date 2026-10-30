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

// Who is signed in, as far as the popup needs: their id and the name to greet.
export interface CampusViewer {
  id: string;
  displayName?: string | null;
}

export type FeedbackPopupComponent = ComponentType<{
  isOpen: boolean;
  onClose: () => void;
  container: RefObject<HTMLElement | null>;
  cohortId: string;
  viewer?: CampusViewer;
}>;

export function FeedbackLayer({
  FeedbackPopup,
  cohortId,
  viewer,
  children,
}: {
  FeedbackPopup?: FeedbackPopupComponent;
  cohortId: string;
  viewer?: CampusViewer;
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
          cohortId={cohortId}
          viewer={viewer}
        />
      ) : null}
    </div>
  );
}
