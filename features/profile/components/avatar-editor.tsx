"use client";

import { cn } from "cn";
import { type ChangeEvent, useId, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";

import { avatarToneOf, initialOf } from "@/shared/lib/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import {
  type AvatarActivity,
  useChangeAvatar,
} from "../hooks/use-change-avatar";
import { cropAvatar } from "../lib/crop-avatar";
import type { OwnProfile } from "../types";

const UNREADABLE_PICTURE =
  "This file couldn't be opened as a picture. Choose a JPEG, PNG or WebP picture.";

// The member's picture in the Profile tab: upload one through a square
// cropper, or remove it to show their initial.
export function AvatarEditor({ profile }: { profile: OwnProfile }) {
  const avatar = useChangeAvatar();
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string>();
  const [isRemoving, setIsRemoving] = useState(false);
  const [pickProblem, setPickProblem] = useState<string>();
  const busy = avatar.activity.kind !== "idle";

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    avatar.clearProblem();
    setPickProblem(undefined);
    if (!file.type.startsWith("image/")) {
      setPickProblem(UNREADABLE_PICTURE);
      return;
    }
    setSource(URL.createObjectURL(file));
  }

  function closeCropper() {
    avatar.cancelUpload();
    avatar.clearProblem();
    if (source) URL.revokeObjectURL(source);
    setSource(undefined);
  }

  async function save(area: Area) {
    if (!source) return;
    const picture = await cropAvatar(source, area);
    if (!picture) {
      setPickProblem(UNREADABLE_PICTURE);
      closeCropper();
      return;
    }
    if (await avatar.changePicture(picture)) closeCropper();
  }

  const problem = pickProblem ?? (source ? undefined : avatar.problem);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {profile.avatarUrl ? (
            <AvatarImage
              src={profile.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : null}
          <AvatarFallback
            className={cn(
              "text-2xl font-semibold",
              avatarToneOf(profile.id, "lemon"),
            )}
          >
            {initialOf(profile.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-muted-foreground text-sm">
            {profile.avatarUrl
              ? "Your picture shows on your avatar across Campus."
              : "Without a picture, your initial shows."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {profile.avatarUrl ? "Change picture" : "Upload picture"}
            </Button>
            {profile.avatarUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setIsRemoving(true)}
                className="text-destructive hover:text-destructive"
              >
                {avatar.activity.kind === "removing"
                  ? "Removing…"
                  : "Remove picture"}
              </Button>
            ) : null}
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          aria-label="Choose a picture"
          className="sr-only"
          tabIndex={-1}
          onChange={pick}
        />
      </div>
      {problem ? (
        <p role="alert" className="text-destructive text-sm">
          {problem}
        </p>
      ) : null}

      {/* Keyed by the picture, so a new one starts uncropped and unzoomed. */}
      <CropDialog
        key={source ?? "closed"}
        activity={avatar.activity}
        onCancelUpload={avatar.cancelUpload}
        onClose={closeCropper}
        onSave={save}
        onUnreadable={() => {
          setPickProblem(UNREADABLE_PICTURE);
          closeCropper();
        }}
        problem={source ? avatar.problem : undefined}
        source={source}
      />
      <RemoveDialog
        busy={busy}
        isOpen={isRemoving}
        onOpenChange={setIsRemoving}
        onRemove={async () => {
          setIsRemoving(false);
          await avatar.removePicture();
        }}
      />
    </div>
  );
}

function CropDialog({
  activity,
  onCancelUpload,
  onClose,
  onSave,
  onUnreadable,
  problem,
  source,
}: {
  activity: AvatarActivity;
  onCancelUpload: () => void;
  onClose: () => void;
  onSave: (area: Area) => Promise<void>;
  onUnreadable: () => void;
  problem: string | undefined;
  source: string | undefined;
}) {
  const zoomId = useId();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area>();
  const [isPreparing, setIsPreparing] = useState(false);
  const busy = isPreparing || activity.kind !== "idle";

  return (
    <Dialog
      open={Boolean(source)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crop your picture</DialogTitle>
          <DialogDescription>
            Drag to move it and zoom to fit the circle.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted relative h-72 overflow-hidden rounded-xl">
          {source ? (
            <Cropper
              image={source}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
              mediaProps={{ onError: onUnreadable }}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor={zoomId} className="text-sm font-medium">
            Zoom
          </label>
          <input
            id={zoomId}
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            disabled={busy}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="accent-primary flex-1"
          />
        </div>
        {activity.kind === "uploading" ? (
          <div
            role="progressbar"
            aria-label="Uploading your picture"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(activity.progress * 100)}
            className="bg-muted h-1.5 overflow-hidden rounded-full"
          >
            <div
              className="bg-primary h-full transition-[width]"
              style={{ width: `${activity.progress * 100}%` }}
            />
          </div>
        ) : null}
        {problem ? (
          <p role="alert" className="text-destructive text-sm">
            {problem}
          </p>
        ) : null}
        <DialogFooter>
          {activity.kind === "uploading" ? (
            <Button type="button" variant="outline" onClick={onCancelUpload}>
              Cancel upload
            </Button>
          ) : (
            <DialogClose render={<Button variant="outline" />} disabled={busy}>
              Cancel
            </DialogClose>
          )}
          <Button
            type="button"
            disabled={!area || busy}
            onClick={async () => {
              if (!area) return;
              setIsPreparing(true);
              try {
                await onSave(area);
              } finally {
                setIsPreparing(false);
              }
            }}
          >
            {activity.kind === "uploading"
              ? `Uploading… ${Math.round(activity.progress * 100)}%`
              : activity.kind === "saving"
                ? "Saving…"
                : "Save picture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Removing also drops the picture Google gave, which signing in again does
// not bring back, so it asks first.
function RemoveDialog({
  busy,
  isOpen,
  onOpenChange,
  onRemove,
}: {
  busy: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Remove your picture?</DialogTitle>
          <DialogDescription>
            Your initial shows instead. A picture from Google won&apos;t come
            back when you sign in again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <DialogClose render={<Button variant="outline" />}>
            Keep picture
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={onRemove}
          >
            Remove picture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
