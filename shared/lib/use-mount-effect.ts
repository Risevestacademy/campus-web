// eslint-disable-next-line no-restricted-imports -- the single sanctioned useEffect wrapper
import { useEffect } from "react";

export function useMountEffect(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
