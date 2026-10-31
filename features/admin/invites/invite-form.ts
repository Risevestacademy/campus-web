import { z } from "zod";

import { parseForm } from "@/shared/lib/forms";

import { ROLE_LABELS } from "../role-labels";
import type { InviteRequest, InviteRole } from "./types/invite.types";

// One popup sends one request per address, one after another. A longer list
// belongs in a file.
export const MAX_EMAILS = 25;

export const INVITE_ROLES = [
  "student",
  "professor",
  "mentor",
  "admin",
] as const;

export function parseInviteRole(value: string): InviteRole | undefined {
  return INVITE_ROLES.find((role) => role === value);
}

// The cohort roles read as they do everywhere else; an admin is not one.
export function inviteRoleLabel(role: InviteRole): string {
  return role === "admin" ? "Admin" : ROLE_LABELS[role];
}

type FieldRule = "required" | "optional" | "off";

interface FieldRules {
  track: FieldRule;
  group: FieldRule;
}

// An admin invite is not placed in a cohort. A mentorship group is a set of
// students, so campus-api refuses a group on any other role; a track is optional for every
// cohort role but a student.
const FIELD_RULES: Readonly<Record<InviteRole, FieldRules>> = {
  student: { track: "required", group: "optional" },
  professor: { track: "optional", group: "off" },
  mentor: { track: "optional", group: "off" },
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

// What the popup's fields hold. The emails travel in one hidden field, space
// separated, since the chips are not inputs of their own.
const inviteFormBase = z.object({
  emails: z
    .string()
    .transform(splitEmails)
    .refine((emails) => emails.length > 0, "Add at least one email.")
    .refine(
      (emails) => emails.length <= MAX_EMAILS,
      `Send up to ${MAX_EMAILS} at a time. For more, use Bulk invite.`,
    )
    // The addresses are not repeated here: the chips already mark them.
    .refine(
      (emails) => emails.every(isValidEmail),
      "Fix or remove the highlighted addresses.",
    ),
  role: z.enum(INVITE_ROLES, "Choose a role."),
  track: z.string(),
  group: z.string(),
});

const inviteFormSchema = inviteFormBase.refine(
  ({ role, track }) => fieldRulesFor(role).track !== "required" || track !== "",
  { path: ["track"], message: "Choose a track." },
);

export type InviteFormData = z.output<typeof inviteFormSchema>;

export type InviteFormErrors = { emails?: string; track?: string };

export function readInviteForm(form: FormData) {
  return parseForm(inviteFormSchema, form);
}

// Only what the role takes is sent, so a track picked for one role never
// travels with another.
export function buildInviteRequests(
  cohortId: string,
  values: InviteFormData,
): InviteRequest[] {
  const { role, track, group } = values;

  if (role === "admin") {
    return values.emails.map((email) => ({ email, systemRole: "admin" }));
  }

  const rules = fieldRulesFor(role);
  return values.emails.map((email) => ({
    email,
    cohortId,
    cohortRole: role,
    ...(rules.track !== "off" && track ? { cohortTrackId: track } : {}),
    ...(rules.group !== "off" && group ? { mentorshipGroupId: group } : {}),
  }));
}
