import type { ReactNode } from "react";

import { Field, FieldContent, FieldDescription } from "@/shared/ui/field";
import { Label } from "@/shared/ui/label";

// One switch with its label and a line of explanation, ruled off from the next.
export function SettingsSwitchRow({
  control,
  description,
  htmlFor,
  label,
}: {
  control: ReactNode;
  description: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <Field
      orientation="horizontal"
      // The shared switch's off track is too faint beside these rows.
      className="border-border [&_[data-slot=switch][data-unchecked]]:bg-border-strong items-center justify-between gap-6 border-b py-4"
    >
      <FieldContent>
        <Label htmlFor={htmlFor} className="text-[15px] font-semibold">
          {label}
        </Label>
        <FieldDescription className="text-foreground-secondary">
          {description}
        </FieldDescription>
      </FieldContent>
      {control}
    </Field>
  );
}

export function SettingsSectionHeading({
  description,
  title,
}: {
  description?: string;
  title: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h3 className="text-foreground text-lg font-semibold">{title}</h3>
      {description ? (
        <p className="text-foreground-secondary text-sm">{description}</p>
      ) : null}
    </div>
  );
}
