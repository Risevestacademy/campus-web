import { z } from "zod";

import type { InviteRequest, InviteRole } from "./types/invite.types";

// One popup sends one request per address, one after another. A longer list
// belongs in a file.
export const MAX_EMAILS = 25;

export const INVITE_ROLES: readonly InviteRole[] = [
  "student",
  "professor",
  "mentor",
  "admin",
];

export const INVITE_ROLE_LABELS: Readonly<Record<InviteRole, string>> = {
  student: "Student",
  professor: "Professor",
  mentor: "Mentor",
  admin: "Admin",
};

type FieldRule = "required" | "optional" | "off";

interface FieldRules {
  track: FieldRule;
  group: FieldRule;
}

// An admin invite is not placed in a cohort. A pod is a set of students, so
// campus-api refuses a group on any other role; a mentor takes no track.
const FIELD_RULES: Readonly<Record<InviteRole, FieldRules>> = {
  student: { track: "required", group: "optional" },
  professor: { track: "optional", group: "off" },
  mentor: { track: "off", group: "off" },
  admin: { track: "off", group: "off" },
};

export function fieldRulesFor(role: InviteRole): FieldRules {
  return FIELD_RULES[role];
}

const emailSchema = z.email();

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}

// Several addresses pasted or typed at once, in any mix of commas, semicolons,
// spaces and lines, lower-cased and without repeats.
export function splitEmails(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function addEmails(current: readonly string[], text: string): string[] {
  return [...new Set([...current, ...splitEmails(text)])];
}

export interface InviteFormValues {
  emails: readonly string[];
  role: InviteRole;
  trackId: string;
  groupId: string;
}

export type InviteFormErrors = { emails?: string; track?: string };

export function validateInviteForm(
  values: InviteFormValues,
): InviteFormErrors | undefined {
  const errors: InviteFormErrors = {};
  const invalid = values.emails.filter((email) => !isValidEmail(email));

  if (values.emails.length === 0) {
    errors.emails = "Add at least one email.";
  } else if (values.emails.length > MAX_EMAILS) {
    errors.emails = `Send up to ${MAX_EMAILS} at a time. For more, use Bulk invite.`;
  } else if (invalid.length > 0) {
    errors.emails = `Fix or remove: ${invalid.join(", ")}`;
  }
  if (
    fieldRulesFor(values.role).track === "required" &&
    values.trackId === ""
  ) {
    errors.track = "Choose a track.";
  }

  return Object.keys(errors).length > 0 ? errors : undefined;
}

// Only what the role takes is sent, so a track picked for one role never
// travels with another.
export function buildInviteRequests(
  cohortId: string,
  values: InviteFormValues,
): InviteRequest[] {
  const { role, trackId, groupId } = values;

  if (role === "admin") {
    return values.emails.map((email) => ({ email, systemRole: "admin" }));
  }

  const rules = fieldRulesFor(role);
  return values.emails.map((email) => ({
    email,
    cohortId,
    cohortRole: role,
    ...(rules.track !== "off" && trackId ? { cohortTrackId: trackId } : {}),
    ...(rules.group !== "off" && groupId ? { mentorshipGroupId: groupId } : {}),
  }));
}
