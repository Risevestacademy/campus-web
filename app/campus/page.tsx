import Link from "next/link";

import { AdministrationCatalogue } from "@/features/admin";
import {
  AccountMenu,
  isSystemAdministrator,
  requireRouteAccess,
  SessionUnavailable,
} from "@/features/auth";
import { CohortChooser } from "@/features/campus";
import { firstSearchParameter } from "@/shared/lib/search-params";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";

type Viewer = Readonly<{ displayName?: string | null; email: string }>;

function initialOf({ displayName, email }: Viewer): string {
  return (displayName || email).charAt(0).toUpperCase();
}

interface CampusPageProps {
  searchParams: Promise<{ view?: string | string[]; page?: string | string[] }>;
}

export default async function CampusPage({ searchParams }: CampusPageProps) {
  const [access, { view, page }] = await Promise.all([
    requireRouteAccess({ kind: "campus-index" }),
    searchParams,
  ]);

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  const cohortSelection = isSystemAdministrator(
    access.session.user.systemRole,
  ) ? (
    <AdministrationCatalogue
      view={firstSearchParameter(view)}
      page={firstSearchParameter(page)}
    />
  ) : (
    <CohortChooser viewer={access.session} />
  );

  return (
    <div data-surface-role="background" className="bg-background space-y-8">
      <header className="flex h-16 items-end justify-between px-10">
        <Link href={"/"} className="flex items-center gap-3">
          <figure
            data-surface-role="surface"
            className="bg-surface ring-border size-12 rounded-xl ring"
          ></figure>
          <h1 className="text-xl font-medium">Campus by Rise</h1>
        </Link>
        <AccountMenu side="bottom">
          <Avatar size="lg">
            <AvatarFallback className="bg-accent text-accent-foreground font-medium">
              {initialOf(access.session.user)}
            </AvatarFallback>
          </Avatar>
        </AccountMenu>
      </header>

      <div className="px-10">{cohortSelection}</div>
    </div>
  );
}
