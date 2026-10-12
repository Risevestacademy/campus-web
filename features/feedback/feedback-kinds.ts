import type { Icon } from "@phosphor-icons/react";
import { BugIcon } from "@phosphor-icons/react/dist/ssr/Bug";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/ssr/ChatCircle";
import { LightbulbIcon } from "@phosphor-icons/react/dist/ssr/Lightbulb";

import type { FeedbackKind } from "./types";

interface FeedbackKindDetails {
  id: FeedbackKind;
  Icon: Icon;
  label: string;
  noun: string;
}

const KIND_DETAILS: Readonly<Record<FeedbackKind, FeedbackKindDetails>> = {
  bug: { id: "bug", Icon: BugIcon, label: "Bug", noun: "bug report" },
  idea: { id: "idea", Icon: LightbulbIcon, label: "Idea", noun: "idea" },
  report: {
    id: "report",
    Icon: ChatCircleIcon,
    label: "Report",
    noun: "report",
  },
};

export const feedbackKinds: readonly FeedbackKindDetails[] =
  Object.values(KIND_DETAILS);

export function feedbackKindDetails(kind: FeedbackKind): FeedbackKindDetails {
  return KIND_DETAILS[kind];
}
