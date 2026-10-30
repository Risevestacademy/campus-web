import { z } from "zod";

import {
  cohortRoleSchema,
  paginationMetaWithTotalSchema,
  systemRoleSchema,
  userStatusSchema,
} from "@/core/api/schemas";

import type {
  PeopleListBody,
  PeoplePage,
  Person,
  PersonCard,
  PersonListItem,
} from "../types/people.types";

const namedUserShape = {
  id: z.string().min(1),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  displayName: z.string().nullable(),
};

const listItemSchema = z.toZod<PersonListItem>()(
  z.object({
    ...namedUserShape,
    systemRole: systemRoleSchema,
    status: userStatusSchema,
    memberships: z.array(
      z.object({
        cohort: z.object({ id: z.string() }),
        track: z.object({ name: z.string() }).nullable(),
        role: cohortRoleSchema,
      }),
    ),
  }),
);

const listSchema = z.toZod<PeopleListBody>()(
  z.object({
    items: z.array(listItemSchema),
    meta: paginationMetaWithTotalSchema,
  }),
);

export function parsePeopleList(
  body: unknown,
  cohortId: string,
): PeoplePage | undefined {
  const parsed = listSchema.safeParse(body);
  if (!parsed.success) return undefined;

  const { items, meta } = parsed.data;
  const people = items.map<Person>(({ memberships, ...user }) => {
    const place = memberships.find(({ cohort }) => cohort.id === cohortId);
    return {
      ...user,
      role: place?.role,
      trackName: place?.track?.name ?? null,
    };
  });

  return { people, ...meta };
}

const cardSchema = z.toZod<PersonCard>()(
  z.object({
    ...namedUserShape,
    memberships: z.array(
      z.object({
        cohort: z.object({ id: z.string(), name: z.string() }),
        track: z.object({ name: z.string() }).nullable(),
        role: cohortRoleSchema,
      }),
    ),
  }),
);

export function parsePersonCard(body: unknown): PersonCard | undefined {
  return cardSchema.safeParse(body).data;
}
