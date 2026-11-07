import { useWalkTo } from "./use-walk-to";

export function useGoToParticipant(cohortId: string) {
  const walkTo = useWalkTo(cohortId);

  return (participantId: string) =>
    walkTo((movement) => movement.sendGoTo(participantId));
}
