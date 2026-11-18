import type { Session } from "../types/auth.types";

export function isSystemAdministrator(
  systemRole: Session["user"]["systemRole"],
): boolean {
  return systemRole === "admin" || systemRole === "super_admin";
}
