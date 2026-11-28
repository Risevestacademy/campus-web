import type { PeopleChip, Person, RosterMember } from "./types/people.types";

export const CHIP_LABELS: Readonly<Record<PeopleChip, string>> = {
  all: "All",
  student: "Students",
  professor: "Professors",
  mentor: "Mentors",
  guest: "Guests",
};

export function personName(
  person: Pick<Person, "displayName" | "firstName" | "lastName" | "email">,
): string {
  const full = [person.firstName, person.lastName].filter(Boolean).join(" ");
  return person.displayName?.trim() || full || person.email;
}

export function firstNameOf(
  person: Pick<Person, "displayName" | "firstName" | "lastName" | "email">,
): string {
  return person.firstName?.trim() || personName(person).split(/\s+/)[0] || "";
}

// How a former member's place ended. A removal sets no student status, and a
// guest whose visit ran out has no leaving date.
export function formerOutcomeOf(
  member: Pick<RosterMember, "role" | "status" | "leftAt">,
): string {
  switch (member.status) {
    case "graduated":
      return "Graduated";
    case "deferred":
      return "Deferred";
    case "withdrawn":
      return "Withdrawn";
    case "dismissed":
      return "Dismissed";
    default:
      return member.role === "guest" && member.leftAt === null
        ? "Visit ended"
        : "Removed";
  }
}

// When the place ended: the day they left, or the day a guest's visit ran
// out. A fixed zone, so the server and the browser print the same day.
export function formerEndedOn(
  member: Pick<RosterMember, "leftAt" | "accessExpiresAt">,
): string | undefined {
  const iso = member.leftAt ?? member.accessExpiresAt;
  return iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : undefined;
}
