"use client";

import { CaretUpIcon } from "@phosphor-icons/react/dist/ssr/CaretUp";
import { Fragment, useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import type { MediaDeviceOption } from "../services/media-device-discovery";

type DiscoveryStatus = "idle" | "loading" | "ready" | "error";

export type MediaDeviceGroup = Readonly<{
  devices: readonly MediaDeviceOption[];
  emptyMessage: string;
  id: string;
  label: string;
}>;

type MediaSettingsDropdownProps = Readonly<{
  discoverGroups: () => Promise<readonly MediaDeviceGroup[]>;
  label: string;
  statusMessages: Readonly<{
    error: string;
    loading: string;
  }>;
  triggerLabel: string;
}>;

type SelectedDeviceIds = Readonly<Record<string, string>>;

function reconcileSelections(
  current: SelectedDeviceIds,
  groups: readonly MediaDeviceGroup[],
): SelectedDeviceIds {
  return Object.fromEntries(
    groups.map((group) => {
      const currentDeviceId = current[group.id];
      const selectedDeviceId =
        currentDeviceId !== undefined &&
        group.devices.some((device) => device.id === currentDeviceId)
          ? currentDeviceId
          : (group.devices[0]?.id ?? "");

      return [group.id, selectedDeviceId];
    }),
  );
}

function DeviceGroup({
  group,
  onValueChange,
  value,
}: Readonly<{
  group: MediaDeviceGroup;
  onValueChange: (value: string) => void;
  value: string;
}>) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{group.label}</DropdownMenuLabel>

      {group.devices.length > 0 ? (
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {group.devices.map((device) => (
            <DropdownMenuRadioItem
              key={device.id}
              value={device.id}
              aria-label={
                device.isDefault
                  ? `${device.label}, system default`
                  : device.label
              }
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{device.label}</span>
                {device.isDefault ? (
                  <span className="text-muted-foreground">System default</span>
                ) : null}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      ) : (
        <DropdownMenuItem disabled>{group.emptyMessage}</DropdownMenuItem>
      )}
    </DropdownMenuGroup>
  );
}

export function MediaSettingsDropdown({
  discoverGroups,
  label,
  statusMessages,
  triggerLabel,
}: MediaSettingsDropdownProps) {
  const [groups, setGroups] = useState<readonly MediaDeviceGroup[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<SelectedDeviceIds>(
    {},
  );
  const [status, setStatus] = useState<DiscoveryStatus>("idle");

  async function refreshDevices() {
    const hasDevices = groups.some((group) => group.devices.length > 0);

    if (!hasDevices) setStatus("loading");

    try {
      const nextGroups = await discoverGroups();

      setGroups(nextGroups);
      setSelectedDeviceIds((current) =>
        reconcileSelections(current, nextGroups),
      );
      setStatus("ready");
    } catch {
      setStatus(hasDevices ? "ready" : "error");
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open || status === "loading") return;
    void refreshDevices();
  }

  const statusMessage =
    status === "error" ? statusMessages.error : statusMessages.loading;
  const showStatus =
    status === "idle" || status === "loading" || status === "error";

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="hover:bg-background w-fit px-1.75"
            aria-label={triggerLabel}
            title={label}
          >
            <CaretUpIcon aria-hidden data-icon="inline-start" />
          </Button>
        }
      />
      <DropdownMenuContent
        aria-label={label}
        align="start"
        side="top"
        sideOffset={8}
        alignOffset={-44}
        className="w-64 max-w-[calc(100vw-2rem)]"
      >
        {showStatus ? (
          <DropdownMenuItem disabled>
            <span role="status" aria-live="polite">
              {statusMessage}
            </span>
          </DropdownMenuItem>
        ) : (
          groups.map((group, index) => (
            <Fragment key={group.id}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              <DeviceGroup
                group={group}
                value={selectedDeviceIds[group.id] ?? ""}
                onValueChange={(value) =>
                  setSelectedDeviceIds((current) => ({
                    ...current,
                    [group.id]: value,
                  }))
                }
              />
            </Fragment>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
