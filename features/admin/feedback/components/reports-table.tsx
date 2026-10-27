import Link from "next/link";

import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { buttonVariants } from "@/shared/ui/button";

import {
  avatarTone,
  describeAge,
  initialOf,
  reportedNameOf,
} from "../feedback-format";
import { feedbackAdministrationHref } from "../feedback-href";
import type { FeedbackFilter, FeedbackPage } from "../types/feedback.types";
import { FeedbackStatusLabel } from "./feedback-status-label";

export function ReportsTable({
  cohortId,
  filter,
  page,
  now,
}: {
  cohortId: string;
  filter: FeedbackFilter;
  page: FeedbackPage;
  now: number;
}) {
  return (
    <div className="border-border overflow-x-auto rounded-3xl border p-3 dark:border-[#2B3B5F]">
      <table className="w-full min-w-208 border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">Reports</caption>
        <thead>
          <tr className="text-foreground-secondary text-xs tracking-wider uppercase">
            <th
              scope="col"
              className="min-w-44 rounded-l-[0.5rem] bg-[#EFFAFF] px-4 py-3 font-medium dark:bg-[#2B3B5F]"
            >
              Report
            </th>
            <th
              scope="col"
              className="min-w-40 bg-[#EFFAFF] px-4 py-3 font-medium dark:bg-[#2B3B5F]"
            >
              Reported
            </th>
            <th
              scope="col"
              className="min-w-32 bg-[#EFFAFF] px-4 py-3 font-medium dark:bg-[#2B3B5F]"
            >
              Where
            </th>
            <th
              scope="col"
              className="bg-[#EFFAFF] px-4 py-3 font-medium dark:bg-[#2B3B5F]"
            >
              Status
            </th>
            <th
              scope="col"
              className="bg-[#EFFAFF] px-4 py-3 font-medium dark:bg-[#2B3B5F]"
            >
              Received
            </th>
            <th
              scope="col"
              className="rounded-r-[0.5rem] bg-[#EFFAFF] px-4 py-3 dark:bg-[#2B3B5F]"
            >
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((report) => {
            const reportedName = reportedNameOf(report);

            return (
              <tr key={report.id} className="group/row">
                <td className="border-border border-b px-4 py-4 font-medium [overflow-wrap:anywhere] group-last/row:border-b-0 dark:border-[#2B3B5F]">
                  {report.title}
                </td>
                <td className="border-border border-b px-4 py-4 group-last/row:border-b-0 dark:border-[#2B3B5F]">
                  {reportedName ? (
                    <span className="flex items-center gap-3">
                      <Avatar size="default">
                        <AvatarFallback
                          className={avatarTone(
                            report.reportedUser?.id ?? reportedName,
                          )}
                        >
                          {initialOf(reportedName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium [overflow-wrap:anywhere]">
                        {reportedName}
                      </span>
                    </span>
                  ) : (
                    <span className="text-foreground-secondary">Not named</span>
                  )}
                </td>
                <td className="border-border text-foreground-secondary border-b px-4 py-4 [overflow-wrap:anywhere] group-last/row:border-b-0 dark:border-[#2B3B5F]">
                  {report.about ?? "—"}
                </td>
                <td className="border-border border-b px-4 py-4 group-last/row:border-b-0 dark:border-[#2B3B5F]">
                  <FeedbackStatusLabel status={report.status} />
                </td>
                <td className="border-border text-foreground-secondary border-b px-4 py-4 group-last/row:border-b-0 dark:border-[#2B3B5F]">
                  {describeAge(report.createdAt, now)}
                </td>
                <td className="border-border border-b px-4 py-4 text-right group-last/row:border-b-0 dark:border-[#2B3B5F]">
                  <Link
                    href={feedbackAdministrationHref(cohortId, {
                      tab: "reports",
                      filter,
                      page: page.page,
                      itemId: report.id,
                    })}
                    aria-label={`Review ${report.title}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Review
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
