export type FeedbackKind = "bug" | "idea" | "report";

export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  title: string;
  details: string;
  location: string;
  submittedLabel: string;
}

export interface NewFeedback {
  kind: FeedbackKind;
  title: string;
  details: string;
  location: string;
  includeDeviceInfo: boolean;
}
