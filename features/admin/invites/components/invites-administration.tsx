import "server-only";

import { LockIcon } from "@phosphor-icons/react/dist/ssr/Lock";
import Link from "next/link";

import { getServerApi } from "@/core/api/client/server";

import { CataloguePagination } from "../../catalogue/catalogue-presentation";
import { Notice } from "../../notice";
import { invitesHref } from "../invites-href";
import { INVITE_TABS, parseInvitesQuery } from "../schemas/invite-query.schema";
import {
  type InvitesView,
  loadInvitesView,
} from "../services/invites-view.service";
import type { InvitesQuery, InviteTab } from "../types/invite.types";
import { InvitesTable } from "./invites-table";

const TAB_LABELS: Readonly<Record<InviteTab, string>> = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  revoked: "Revoked",
};

const EMPTY_TEXT: Readonly<Record<InviteTab, string>> = {
  pending: "No pending invites.",
  accepted: "No accepted invites.",
  expired: "No expired invites.",
  revoked: "No revoked invites.",
};

function Tabs({
  cohortId,
  query,
  counts,
}: {
  cohortId: string;
  query: InvitesQuery;
  counts: InvitesView["counts"];
}) {
  return (
    <nav aria-label="Invite status">
      <ul className="flex flex-wrap gap-2">
        {INVITE_TABS.map((tab) => {
          const count = counts[tab];

          return (
            <li key={tab}>
              <Link
                href={invitesHref(cohortId, { tab })}
                aria-current={tab === query.tab ? "true" : undefined}
                className="border-border dark:aria-[current=true]:bg-primary inline-flex items-center rounded-full border px-4 py-2 text-sm hover:bg-[#E9ECF6] aria-[current=true]:border-transparent aria-[current=true]:bg-[#152228] aria-[current=true]:text-[#F7F7F7] dark:border-[#2B3B5F] dark:hover:bg-[#2B3B5F]"
              >
                {TAB_LABELS[tab]}
                {count === undefined ? null : ` ${count}`}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function InvitesList({
  cohortId,
  query,
  view,
}: {
  cohortId: string;
  query: InvitesQuery;
  view: InvitesView;
}) {
  const { list, now } = view;

  if (list.kind === "unavailable") {
    return (
      <Notice>
        We couldn&apos;t load invites.{" "}
        <Link
          className="text-primary underline"
          href={invitesHref(cohortId, query)}
        >
          Try again
        </Link>
      </Notice>
    );
  }
  if (list.invites.length === 0)
    return <Notice>{EMPTY_TEXT[query.tab]}</Notice>;

  return (
    <>
      <InvitesTable invites={list.invites} now={now} />
      <CataloguePagination
        ariaLabel="Invite pages"
        hrefForPage={(page) => invitesHref(cohortId, { ...query, page })}
        page={list.page}
        totalPages={list.totalPages}
      />
    </>
  );
}

export function InvitesAdministrationView({
  cohortId,
  query,
  view,
}: {
  cohortId: string;
  query: InvitesQuery;
  view: InvitesView;
}) {
  return (
    <section
      aria-labelledby="invites-heading"
      className="grid content-start gap-6 p-10"
    >
      <header>
        <h1
          id="invites-heading"
          className="font-display text-3xl font-semibold"
        >
          Invites
        </h1>
        <p className="text-foreground-secondary mt-2">
          Invite-only. Role, cohort and track travel with the invite.
        </p>
      </header>

      <Tabs cohortId={cohortId} query={query} counts={view.counts} />
      <InvitesList cohortId={cohortId} query={query} view={view} />

      <p className="text-foreground-secondary flex items-center gap-2 text-sm">
        <LockIcon aria-hidden size={16} />
        After accepting, people sign in with Google. No passwords.
      </p>
    </section>
  );
}

export async function InvitesAdministration({
  cohortId,
  rawQuery,
}: {
  cohortId: string;
  rawQuery: { status?: string; page?: string };
}) {
  const query = parseInvitesQuery(rawQuery);
  const view = await loadInvitesView(await getServerApi(), cohortId, query);

  return (
    <InvitesAdministrationView cohortId={cohortId} query={query} view={view} />
  );
}
