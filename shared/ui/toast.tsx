"use client";

import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { InfoIcon } from "@phosphor-icons/react/dist/ssr/Info";
import { SpinnerIcon } from "@phosphor-icons/react/dist/ssr/Spinner";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { XCircleIcon } from "@phosphor-icons/react/dist/ssr/XCircle";
import { cn } from "cn";
import type { ReactNode } from "react";

import { Button } from "@/shared/ui/button";

const toast = ToastPrimitive.createToastManager();

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />;
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />;
}

// Above every z-50 overlay: toasts report on whatever is open, including
// dialogs, so a modal backdrop must never cover them. Top right, stacking
// downward, just below the row where the meeting header and its view switch sit,
// so a toast that stays never covers them.
function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed inset-x-4 top-16 z-[100] mx-auto w-auto max-w-md outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
        className,
      )}
      {...props}
    />
  );
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      swipeDirection={["up", "right"]}
      className={cn(
        "group/toast bg-popover text-popover-foreground focus-visible:border-ring focus-visible:ring-ring/50 ring-foreground/10 pointer-events-auto absolute top-0 right-0 z-[calc(1000-var(--toast-index))] w-full origin-top rounded-2xl shadow-lg ring-1 will-change-transform outline-none select-none focus-visible:ring-[3px]",
        "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)+calc(var(--toast-index)*var(--gap))+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
        "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+(var(--toast-index)*var(--peek))+(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_400ms_cubic-bezier(0.22,1,0.36,1),opacity_400ms_cubic-bezier(0.22,1,0.36,1),height_150ms] motion-reduce:[transition:opacity_200ms_ease]",
        "after:absolute after:bottom-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
        "data-limited:opacity-0 data-starting-style:[transform:translateY(-150%)]",
        "motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:[transform:none]! motion-reduce:data-starting-style:opacity-0 motion-reduce:[&[data-ending-style]:not([data-swipe-direction])]:[transform:none]!",
        "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(-150%)]",
        "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        className,
      )}
      {...props}
    />
  );
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn(
        "flex h-full items-start gap-3 overflow-hidden p-4 transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-expanded:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
}

function ToastDescription({
  className,
  ...props
}: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-muted-foreground text-sm text-pretty", className)}
      {...props}
    />
  );
}

function ToastAction({
  className,
  render = <Button variant="outline" size="sm" />,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={render}
      className={cn("shrink-0", className)}
      {...props}
    />
  );
}

function ToastClose({
  className,
  children,
  render = <Button variant="ghost" size="icon-sm" />,
  ...props
}: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Close toast"
      render={render}
      className={cn(
        "text-muted-foreground hover:text-foreground relative shrink-0 after:absolute after:-inset-2 after:content-['']",
        className,
      )}
      {...props}
    >
      {children ?? <XIcon aria-hidden="true" />}
    </ToastPrimitive.Close>
  );
}

function ToastIcon({ type }: { type: string | undefined }) {
  let icon: React.ReactNode = null;

  if (type === "success") {
    icon = <CheckCircleIcon aria-hidden="true" />;
  }

  if (type === "info") {
    icon = <InfoIcon aria-hidden="true" />;
  }

  if (type === "warning") {
    icon = <WarningIcon className="text-warning-icon" aria-hidden="true" />;
  }

  if (type === "error") {
    icon = <XCircleIcon className="text-destructive" aria-hidden="true" />;
  }

  if (type === "loading") {
    icon = <SpinnerIcon className="animate-spin" aria-hidden="true" />;
  }

  if (!icon) {
    return null;
  }

  return (
    <span
      data-slot="toast-icon"
      className="mt-0.5 shrink-0 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
    >
      {icon}
    </span>
  );
}

export type ToastTileTone =
  "locked" | "progress" | "success" | "warning" | "neutral" | "error" | "plain";

export type ToastTileAction = Readonly<{
  label: string;
  onClick: () => void;
  variant?: "default" | "outline";
}>;

// A toast that leads with a tinted icon tile and keeps its actions beside the
// text, for flows that ask the member to act. Passed as the toast's `data`.
export type ToastTile = Readonly<{
  actions?: readonly ToastTileAction[];
  closable?: boolean;
  icon: ReactNode;
  tone: ToastTileTone;
}>;

const TILE_TONE_CLASS_NAMES: Record<ToastTileTone, string> = {
  locked: "bg-neutral-950 text-lemon-400 dark:bg-neutral-800",
  progress: "bg-surface-elevated text-primary",
  success: "bg-success-subtle text-success-foreground",
  warning: "bg-warning-subtle text-warning-foreground",
  neutral: "bg-surface text-foreground-secondary",
  error: "bg-error-subtle text-error-icon",
  plain: "",
};

function tileOf(data: unknown): ToastTile | undefined {
  if (typeof data !== "object" || data === null || !("tile" in data)) {
    return undefined;
  }
  return (data as { tile: ToastTile }).tile;
}

function TileToastContent({ tile }: Readonly<{ tile: ToastTile }>) {
  return (
    <ToastContent className="items-center p-3">
      <span
        data-slot="toast-tile"
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl [&_svg:not([class*='size-'])]:size-4.5",
          TILE_TONE_CLASS_NAMES[tile.tone],
        )}
      >
        {tile.icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <ToastTitle className="font-semibold" />
        <ToastDescription className="text-foreground-secondary text-[0.8125rem]" />
      </div>
      {tile.actions?.map(({ label, onClick, variant = "default" }) => (
        <Button
          key={label}
          type="button"
          size="sm"
          variant={variant}
          onClick={onClick}
          className="shrink-0"
        >
          {label}
        </Button>
      ))}
      {tile.closable === false ? null : <ToastClose />}
    </ToastContent>
  );
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();

  return toasts.map((toastItem) => {
    const tile = tileOf(toastItem.data);
    if (tile) {
      return (
        <Toast key={toastItem.id} toast={toastItem}>
          <TileToastContent tile={tile} />
        </Toast>
      );
    }
    return <PlainToast key={toastItem.id} toastItem={toastItem} />;
  });
}

function PlainToast({
  toastItem,
}: Readonly<{ toastItem: ToastPrimitive.Root.ToastObject }>) {
  return (
    <Toast toast={toastItem}>
      <ToastContent>
        <ToastIcon type={toastItem.type} />
        {/* The action sits under the text, so the text keeps the full width. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ToastTitle />
          <ToastDescription />
          {toastItem.actionProps ? (
            <ToastAction className="mt-2 self-start" />
          ) : null}
        </div>
        <ToastClose />
      </ToastContent>
    </Toast>
  );
}

function Toaster({
  children,
  toastManager = toast,
  ...props
}: ToastPrimitive.Provider.Props) {
  return (
    <ToastProvider toastManager={toastManager} {...props}>
      {children}
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  );
}

const createToastManager = ToastPrimitive.createToastManager;
const useToastManager = ToastPrimitive.useToastManager;

export {
  createToastManager,
  Toast,
  toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  Toaster,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  useToastManager,
};
