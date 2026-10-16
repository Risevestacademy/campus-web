import Link from "next/link";

import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { buttonVariants } from "@/shared/ui/button";

import { splitReportAbout } from "../feedback-about";
import {
  avatarTone,
  describeAge,
  initialOf,
  personName,
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
      <table className="w-full min-w-208 text-left text-sm">
        <caption className="sr-only">Reports</caption>
        <thead>
          <tr className="text-foreground-secondary bg-[#EFFAFF] text-xs tracking-wider uppercase dark:bg-[#2B3B5F]">
            <th
              scope="col"
              className="min-w-44 rounded-l-xl px-4 py-3 font-medium"
            >
              Report
            </th>
            <th scope="col" className="min-w-40 px-4 py-3 font-medium">
              Reported
            </th>
            <th scope="col" className="min-w-32 px-4 py-3 font-medium">
              Where
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Received
            </th>
            <th scope="col" className="rounded-r-xl px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((report) => {
            const { reported, where } = splitReportAbout(report.about);
            const reportedName =
              reported ??
              (report.reportedUser
                ? personName(report.reportedUser)
                : undefined);

            return (
              <tr
                key={report.id}
                className="border-border border-b last:border-b-0 dark:border-[#2B3B5F]"
              >
                <td className="px-4 py-4 font-medium [overflow-wrap:anywhere]">
                  {report.title}
                </td>
                <td className="px-4 py-4">
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
                <td className="text-foreground-secondary px-4 py-4 [overflow-wrap:anywhere]">
                  {where ?? "—"}
                </td>
                <td className="px-4 py-4">
                  <FeedbackStatusLabel status={report.status} />
                </td>
                <td className="text-foreground-secondary px-4 py-4">
                  {describeAge(report.createdAt, now)}
                </td>
                <td className="px-4 py-4 text-right">
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
