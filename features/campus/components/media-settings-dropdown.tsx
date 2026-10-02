"use client";

import { CaretUpIcon } from "@phosphor-icons/react/dist/ssr/CaretUp";
import { Fragment, type ReactNode } from "react";

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

import type {
  DeviceDiscoveryStatus,
  MediaDeviceOption,
} from "../services/media-session/contracts";

type DiscoveryViewStatus = Exclude<DeviceDiscoveryStatus, "failed"> | "error";

export type MediaDeviceGroup = Readonly<{
  devices: readonly MediaDeviceOption[];
  emptyMessage: string;
  id: string;
  label: string;
}>;

type MediaSettingsDropdownProps = Readonly<{
  action?: ReactNode;
  deviceDiscoveryStatus: DeviceDiscoveryStatus;
  groups: readonly MediaDeviceGroup[];
  label: string;
  onRefresh: () => Promise<void>;
  onSelectionChange: (groupId: string, deviceId: string) => void;
  selectedDeviceIds: Readonly<Record<string, string>>;
  statusMessages: Readonly<{
    error: string;
    loading: string;
  }>;
  triggerLabel: string;
}>;

function getDiscoveryViewStatus(
  deviceDiscoveryStatus: DeviceDiscoveryStatus,
  groups: readonly MediaDeviceGroup[],
): DiscoveryViewStatus {
  if (deviceDiscoveryStatus !== "failed") return deviceDiscoveryStatus;

  return groups.some((group) => group.devices.length > 0) ? "ready" : "error";
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
  action,
  deviceDiscoveryStatus,
  groups,
  label,
  onRefresh,
  onSelectionChange,
  selectedDeviceIds,
  statusMessages,
  triggerLabel,
}: MediaSettingsDropdownProps) {
  const status = getDiscoveryViewStatus(deviceDiscoveryStatus, groups);

  function handleOpenChange(open: boolean) {
    if (!open || status === "loading") return;
    void onRefresh();
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
          <>
            {groups.map((group, index) => (
              <Fragment key={group.id}>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                <DeviceGroup
                  group={group}
                  value={selectedDeviceIds[group.id] ?? ""}
                  onValueChange={(value) => onSelectionChange(group.id, value)}
                />
              </Fragment>
            ))}
            {action ? (
              <>
                <DropdownMenuSeparator />
                {action}
              </>
            ) : null}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
