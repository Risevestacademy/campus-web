import type { RoomLinkProblem } from "./room-link-api.adapter";

const NOTICES: Readonly<Record<RoomLinkProblem, string>> = {
  invalid: "Give the event a name of up to 128 characters.",
  "signed-out": "Your session ran out. Sign in and try again.",
  forbidden: "You can't make room links for this cohort.",
  "space-unavailable": "That space can't take a link. Choose another.",
  unavailable: "We couldn't make the link. Try again.",
};

export function noticeForProblem(problem: RoomLinkProblem): string {
  return NOTICES[problem];
}
