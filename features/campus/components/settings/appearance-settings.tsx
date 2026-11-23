"use client";

import { cn } from "cn";
import { type ReactNode, useId } from "react";

import { useMotionPreference } from "@/shared/motion/use-motion-preference";
import type { ThemePreference } from "@/shared/theme";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Switch } from "@/shared/ui/switch";
import { useThemePreference } from "@/shared/ui/theme-toggle/use-theme-preference";

import { SettingsSectionHeading, SettingsSwitchRow } from "./settings-row";

// The previews show the theme itself, so they keep its colours whichever
// theme is active.
const themeChoices: readonly {
  label: string;
  preview: ReactNode;
  value: ThemePreference;
}[] = [
  {
    value: "light",
    label: "Light",
    preview: (
      <div className="flex h-full gap-1.5 bg-[#F7F7F7] p-1.5">
        <div className="w-3 rounded-sm bg-[#3155D6]" />
        <div className="flex-1 rounded-sm border border-[#DEDEDE] bg-white" />
      </div>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    preview: (
      <div className="flex h-full gap-1.5 bg-[#141B2D] p-1.5">
        <div className="w-3 rounded-sm border border-[#2B3B5F] bg-[#162350]" />
        <div className="flex-1 rounded-sm border border-[#2B3B5F] bg-[#1F2940]" />
      </div>
    ),
  },
  {
    value: "system",
    label: "Match device",
    preview: (
      <div className="flex h-full">
        <div className="flex-1 bg-[#F7F7F7]" />
        <div className="flex-1 bg-[#141B2D]" />
      </div>
    ),
  },
];

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function ThemeChoice({
  label,
  preview,
  value,
}: {
  label: string;
  preview: ReactNode;
  value: ThemePreference;
}) {
  const labelId = useId();

  return (
    <label
      className={cn(
        "border-border-strong hover:bg-surface-hover flex cursor-pointer flex-col gap-2.5 rounded-xl border p-2.5 transition-colors",
        "has-data-checked:border-primary has-data-checked:bg-surface-elevated has-data-checked:ring-primary has-data-checked:ring-1",
        "has-focus-visible:ring-ring/50 has-focus-visible:ring-3",
      )}
    >
      <div
        aria-hidden
        className="border-border h-18 overflow-hidden rounded-lg border"
      >
        {preview}
      </div>
      <span className="flex items-center gap-2 text-sm font-semibold">
        <RadioGroupItem value={value} aria-labelledby={labelId} />
        <span id={labelId}>{label}</span>
      </span>
    </label>
  );
}

export function AppearanceSettings() {
  const { preference, setPreference } = useThemePreference();
  const { reduceMotion, setReduceMotion } = useMotionPreference();
  const themeLegendId = useId();
  const motionSwitchId = useId();

  return (
    <>
      <SettingsSectionHeading
        title="Appearance"
        description="Saved on this device only."
      />

      <div className="flex flex-col gap-3">
        <span id={themeLegendId} className="text-sm font-semibold">
          Theme
        </span>
        <RadioGroup
          aria-labelledby={themeLegendId}
          value={preference}
          onValueChange={(value) => {
            if (isThemePreference(value)) setPreference(value);
          }}
          className="grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {themeChoices.map((choice) => (
            <ThemeChoice key={choice.value} {...choice} />
          ))}
        </RadioGroup>
      </div>

      <div className="border-border mt-7 border-t">
        <SettingsSwitchRow
          htmlFor={motionSwitchId}
          label="Reduce motion"
          description="Fewer animations across Campus, even if your device allows them."
          control={
            <Switch
              id={motionSwitchId}
              checked={reduceMotion}
              onCheckedChange={setReduceMotion}
            />
          }
        />
      </div>
    </>
  );
}
