"use client";

import { cn } from "cn";
import { useMemo, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";

import { useMapSync } from "../hooks/use-map-sync";
import { usePublishMap } from "../hooks/use-publish-map";
import {
  buildMapView,
  canPublish,
  entrySyncOf,
  type MapVersionState,
  mapVersionState,
} from "../services/map-view";
import type {
  EntryMapRecord,
  GrantOptions,
  MapPublishProblem,
  MapSyncProblem,
  MapSyncResult,
  PublishedEntryMap,
  SpaceSettings,
} from "../types/maps.types";
import { GrantOptionsProvider } from "./grant-options-context";
import { MapCanvas } from "./map-canvas";
import { MapLegend } from "./map-legend";
import { SpaceSheet } from "./space-sheet";

const SYNC_PROBLEMS: Readonly<Record<MapSyncProblem, string | undefined>> = {
  busy: "Another sync is running. Wait for it to finish, then preview again to see what is left.",
  rejected:
    "The published maps can't be used, so nothing was changed. Pass this list to whoever publishes the maps in Sanity.",
  "sanity-unreachable":
    "Sanity didn't answer, so nothing was changed. Try again in a moment.",
  "not-configured":
    "Map sync isn't set up on this deployment: campus-api doesn't know where the maps are published.",
  invalid: "campus-api refused the request. Refresh the page and try again.",
  "signed-out": undefined,
  forbidden: "Only administrators can sync maps.",
  unavailable:
    "We couldn't reach campus-api. Check your connection and try again.",
};

const PUBLISH_PROBLEMS: Readonly<
  Record<MapPublishProblem, string | undefined>
> = {
  refused:
    "This map can't be published: only the map people enter on can be served, and it can't be retired. Sync, then try again.",
  missing: "campus-api has no such map. Sync first, then publish.",
  invalid: "campus-api refused the request. Refresh the page and try again.",
  "signed-out": undefined,
  forbidden: "Only administrators can publish maps.",
  unavailable:
    "We couldn't publish the map. Check your connection and try again.",
};

const VERSION_BADGES: Readonly<
  Record<MapVersionState, { label: string; tone: string }>
> = {
  "not-in-campus": {
    label: "Not in the campus yet",
    tone: "bg-warning-subtle text-warning-foreground",
  },
  unknown: {
    label: "Version unknown, sync once",
    tone: "bg-surface-elevated text-foreground-secondary",
  },
  "sanity-ahead": {
    label: "Sanity has a newer map",
    tone: "bg-warning-subtle text-warning-foreground",
  },
  "not-published": {
    label: "Synced, not published",
    tone: "bg-surface-elevated text-brand-foreground",
  },
  live: { label: "Live", tone: "bg-success-subtle text-success-foreground" },
};

// Why Publish is held back, when it is.
const PUBLISH_HELD: Readonly<Record<MapVersionState, string | undefined>> = {
  "not-in-campus":
    "Sync before publishing: the campus doesn't hold this map yet.",
  unknown:
    "Sync once before publishing, so the campus records which version it holds.",
  "sanity-ahead":
    "Sync before publishing: world loads whatever Sanity holds, and the campus is behind it.",
  "not-published": undefined,
  live: undefined,
};

function changeCount(result: MapSyncResult | undefined, mapKey: string) {
  const entry = entrySyncOf(result, mapKey);
  if (!entry) return 0;
  return (
    entry.spaces.added.length +
    entry.spaces.restored.length +
    entry.spaces.retired.length +
    entry.desks.added.length +
    entry.desks.restored.length +
    entry.desks.retired.length
  );
}

function statusLine(
  result: MapSyncResult | undefined,
  changes: number,
  versionBehind: boolean,
) {
  if (!result) return "Preview a sync to see what the published map changes.";
  if (!result.changed) {
    return versionBehind && result.dryRun
      ? "No space or desk changes, but the campus hasn't recorded this version yet. Sync to record it."
      : "Already up to date: the campus matches what is published.";
  }
  return result.dryRun
    ? `Preview: syncing would make ${changes} ${changes === 1 ? "change" : "changes"} here. Nothing is kept yet.`
    : "Synced. Set up any new spaces, then publish.";
}

export function MapWorkspace({
  map,
  entry,
  spaces,
  cohortId,
  grantOptions,
}: {
  map: PublishedEntryMap;
  entry: EntryMapRecord | null;
  spaces: SpaceSettings[];
  cohortId: string;
  grantOptions: GrantOptions;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showChanges, setShowChanges] = useState(true);
  const syncing = useMapSync();
  const publishing = usePublishMap({ mapKey: map.mapKey });

  const entrySync = entrySyncOf(syncing.result, map.mapKey);
  const view = useMemo(
    () => buildMapView(map, spaces, showChanges ? entrySync : undefined),
    [map, spaces, showChanges, entrySync],
  );
  const changes = changeCount(syncing.result, map.mapKey);
  const versionState = mapVersionState(map, entry);
  const badge = VERSION_BADGES[versionState];
  const publishHeld = PUBLISH_HELD[versionState];
  // `changed` stays false when only the version moved, so the versions say
  // whether a sync still has something to record.
  const versionBehind = !canPublish(versionState);
  const canSync =
    syncing.result?.dryRun === true &&
    (syncing.result.changed || versionBehind);
  const selected = view.spaces.find(({ key }) => key === selectedKey);
  const firstNeedingKind = view.spaces.find(
    ({ state }) => state === "needs-kind",
  );
  const syncMessage = syncing.problem
    ? SYNC_PROBLEMS[syncing.problem]
    : undefined;
  const publishMessage = publishing.problem
    ? PUBLISH_PROBLEMS[publishing.problem]
    : undefined;
  const busy = syncing.isPending || publishing.isPending;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {entry && versionState !== "not-in-campus"
              ? entry.name
              : map.mapKey}
            <span className="bg-surface-elevated text-brand-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
              Entry map
            </span>
            <span
              className={cn(
                badge.tone,
                "rounded-full px-2 py-0.5 text-xs font-semibold",
              )}
            >
              {badge.label}
            </span>
          </h2>
          <p role="status" className="text-foreground-secondary text-sm">
            {statusLine(syncing.result, changes, versionBehind)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {syncing.result?.changed ? (
            <label className="text-foreground-secondary flex min-h-11 items-center gap-2 text-sm font-medium">
              <Switch checked={showChanges} onCheckedChange={setShowChanges} />
              Show what changed
            </label>
          ) : null}
          <Button variant="outline" disabled={busy} onClick={syncing.preview}>
            {syncing.isPending && !canSync ? "Previewing…" : "Preview sync"}
          </Button>
          {canSync ? (
            <Button disabled={busy} onClick={syncing.sync}>
              {syncing.isPending
                ? "Syncing…"
                : changes > 0
                  ? `Sync ${changes} ${changes === 1 ? "change" : "changes"}`
                  : "Sync"}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            disabled={busy || !entry || publishHeld !== undefined}
            onClick={() => {
              if (entry) publishing.publish(entry.id);
            }}
          >
            {publishing.isPending ? "Publishing…" : `Publish ${map.mapKey}`}
          </Button>
        </div>
      </div>

      {syncMessage ? (
        <div
          role="alert"
          className="border-warning-border bg-warning-subtle text-warning-foreground grid gap-2 rounded-xl border p-4 text-sm"
        >
          <p>{syncMessage}</p>
          {syncing.mapProblems.length > 0 ? (
            <ul className="list-disc pl-5">
              {syncing.mapProblems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {publishMessage ? (
        <p
          role="alert"
          className="border-error-border bg-error-subtle text-error-foreground rounded-xl border p-4 text-sm"
        >
          {publishMessage}
        </p>
      ) : null}

      {publishHeld ? (
        <p className="text-foreground-secondary text-sm">{publishHeld}</p>
      ) : null}

      {firstNeedingKind ? (
        <div className="border-warning-border bg-warning-subtle flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2">
          <p className="text-warning-foreground text-sm">
            <strong className="font-semibold">
              {view.needsKind === 1
                ? "1 space needs a kind."
                : `${view.needsKind} spaces need a kind.`}
            </strong>{" "}
            Until it has one, only admins can enter.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedKey(firstNeedingKind.key)}
          >
            Show me
          </Button>
        </div>
      ) : null}

      <GrantOptionsProvider value={{ cohortId, options: grantOptions }}>
        <MapCanvas
          widthTiles={map.widthTiles}
          heightTiles={map.heightTiles}
          walls={map.walls}
          view={view}
          showChanges={showChanges}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
        />
        {selected ? (
          <SpaceSheet
            key={selected.key}
            space={selected}
            onClose={() => setSelectedKey(null)}
          />
        ) : null}
      </GrantOptionsProvider>

      {view.leavingSpaces.length > 0 || view.leavingDesks.length > 0 ? (
        <section
          aria-labelledby="leaving-heading"
          className="border-error-border grid gap-1 rounded-xl border border-dashed p-4 text-sm"
        >
          <h2
            id="leaving-heading"
            className="text-error-foreground font-semibold"
          >
            Leaving the map
          </h2>
          <p className="text-foreground-secondary">
            No longer drawn on the published map. A sync retires them: their
            rows stay, but nobody can enter, and anyone holding a retired desk
            loses it.
          </p>
          <p>
            {[
              ...view.leavingSpaces.map(({ name }) => name),
              ...view.leavingDesks,
            ].join(", ")}
          </p>
        </section>
      ) : null}

      <MapLegend />
    </div>
  );
}
