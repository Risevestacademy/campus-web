export type RoomLinkAccess = "any-space" | "own-space" | "none";

// Admins pick any space. Professors and mentors make a link for the space they
// stand in. Everyone else makes none: campus-api refuses them too.
export function roomLinkAccess({
  administrator,
  role,
}: Readonly<{
  administrator: boolean;
  role?: "student" | "professor" | "mentor" | "guest";
}>): RoomLinkAccess {
  if (administrator) return "any-space";
  return role === "professor" || role === "mentor" ? "own-space" : "none";
}
