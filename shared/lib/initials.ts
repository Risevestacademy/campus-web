const UNKNOWN_INITIALS = "?";

export function initialsOf(name: string | null | undefined): string {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return initials || UNKNOWN_INITIALS;
}
