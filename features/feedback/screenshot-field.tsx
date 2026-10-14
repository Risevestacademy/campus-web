import { PaperclipIcon } from "@phosphor-icons/react/dist/ssr/Paperclip";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { type DragEvent, useRef, useState } from "react";

import { Button } from "@/shared/ui/button";

import { SCREENSHOT_TYPES } from "./schemas/feedback.schema";

export interface SelectedScreenshot {
  name: string;
  previewUrl: string;
}

export function ScreenshotField({
  screenshot,
  problem,
  onSelect,
  onRemove,
}: {
  screenshot: SelectedScreenshot | undefined;
  problem: string | undefined;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function drop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onSelect(file);
  }

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={SCREENSHOT_TYPES.join(",")}
        tabIndex={-1}
        aria-label="Screenshot file"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelect(file);
          event.target.value = "";
        }}
      />

      {screenshot ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#9DB6C6] bg-[#EFFAFF] p-3 dark:border-[#4A5C85] dark:bg-[#2B3B5F]">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL, not an optimisable asset */}
          <img
            src={screenshot.previewUrl}
            alt="Screenshot preview"
            className="size-14 shrink-0 rounded-lg object-cover"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {screenshot.name}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove screenshot"
            onClick={onRemove}
          >
            <XIcon aria-hidden />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={drop}
          data-dragging={isDragging ? "true" : undefined}
          className="focus-visible:ring-ring/50 data-[dragging=true]:border-cobalt-500 flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#9DB6C6] bg-[#EFFAFF] p-4 text-left outline-none focus-visible:ring-3 dark:border-[#4A5C85] dark:bg-[#2B3B5F]"
        >
          <PaperclipIcon
            aria-hidden
            size={22}
            className="text-icon-muted shrink-0"
          />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">Add a screenshot</span>
            <span className="text-foreground-secondary text-sm">
              Drop an image or paste from clipboard
            </span>
          </span>
        </button>
      )}

      {problem ? (
        <p role="alert" className="text-destructive text-sm">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
