import type { ReactNode } from "react";

import { renderWithAccess } from "./access-gate";

export async function CampusShellGate({ children }: { children: ReactNode }) {
  return renderWithAccess({ kind: "campus-shell" }, children);
}
