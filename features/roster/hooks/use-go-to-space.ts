import { useWalkTo } from "./use-walk-to";

export function useGoToSpace(cohortId: string) {
  const walkTo = useWalkTo(cohortId);

  return (spaceKey: string) =>
    walkTo((movement) => movement.sendGoToSpace(spaceKey));
}
