"use client";

import { useId } from "react";

import { useAnalyticsConsent } from "@/core/analytics/consent";
import { Switch } from "@/shared/ui/switch";

import { SettingsSectionHeading, SettingsSwitchRow } from "./settings-row";

function describeAnalytics(consent: string): string {
  switch (consent) {
    case "unavailable":
      return "Usage analytics isn't available in this browser.";
    case "pending":
      return "You haven't chosen yet. Campus shares nothing until you do.";
    default:
      return "Share anonymous usage data so we can improve Campus.";
  }
}

export function PrivacySettings() {
  const { consent, accept, reject } = useAnalyticsConsent();
  const analyticsSwitchId = useId();
  const isKnown = consent !== "unknown" && consent !== "unavailable";

  return (
    <>
      <SettingsSectionHeading
        title="Privacy"
        description="What Campus may collect about how you use it."
      />
      <div className="border-border border-t">
        <SettingsSwitchRow
          htmlFor={analyticsSwitchId}
          label="Usage analytics"
          description={describeAnalytics(consent)}
          control={
            <Switch
              id={analyticsSwitchId}
              checked={consent === "granted"}
              disabled={!isKnown}
              onCheckedChange={(checked) => (checked ? accept() : reject())}
            />
          }
        />
      </div>
    </>
  );
}
