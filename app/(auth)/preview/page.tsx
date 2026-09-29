import Link from "next/link";

import { Button, buttonVariants } from "@/shared/ui/button";

const profileDetails = {
  name: "David Olaleye",
  email: "someone@email.com",
  role: "Student",
  cohort: "Product Design 2026",
};

export default function ProfilePreviewPage() {
  return (
    <div className="grid gap-6">
      <span className="text-foreground-secondary font-semibold tracking-wide uppercase">
        Check your details
      </span>
      <h1 className="font-display text-3xl font-bold">
        Are your details correct?
      </h1>
      <dl className="max-w-124 space-y-4">
        {Object.entries(profileDetails).map(([detail, value]) => (
          <div key={detail} className="flex items-center justify-between">
            <dt className="capitalize">{detail}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm font-medium">
        Set by campus admin - not editable here
      </p>

      <div className="mt-4 flex gap-4 *:max-w-60 *:flex-1">
        <Button size="lg" variant="outline">
          Flag an Issue
        </Button>
        <Link
          href={"/campus/1/join"}
          className={buttonVariants({ size: "lg" })}
        >
          Go to Campus
        </Link>
      </div>
    </div>
  );
}
