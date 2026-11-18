import type { PeopleChip, Person } from "./types/people.types";

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
