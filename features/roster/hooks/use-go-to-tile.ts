import { useWalkTo } from "./use-walk-to";

export function useGoToTile(cohortId: string) {
  const walkTo = useWalkTo(cohortId);

  return (tile: { x: number; y: number }) =>
    walkTo((movement) => movement.sendGoToTile(tile));
}
