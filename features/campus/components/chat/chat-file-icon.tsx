import { FileIcon } from "@phosphor-icons/react/dist/ssr/File";
import { FileDocIcon } from "@phosphor-icons/react/dist/ssr/FileDoc";
import { FileImageIcon } from "@phosphor-icons/react/dist/ssr/FileImage";
import { FilePdfIcon } from "@phosphor-icons/react/dist/ssr/FilePdf";
import { FilePptIcon } from "@phosphor-icons/react/dist/ssr/FilePpt";
import { FileXlsIcon } from "@phosphor-icons/react/dist/ssr/FileXls";

import type { FileKind } from "../../services/chat/chat-files";

const ICONS = {
  image: FileImageIcon,
  pdf: FilePdfIcon,
  document: FileDocIcon,
  spreadsheet: FileXlsIcon,
  presentation: FilePptIcon,
  file: FileIcon,
} as const satisfies Record<FileKind, unknown>;

// A file's icon, chosen from the kinds that are known; the rest are plain.
export function ChatFileIcon({ kind }: Readonly<{ kind: FileKind }>) {
  const Icon = ICONS[kind];

  return (
    <span className="bg-surface-hover text-primary grid size-9 shrink-0 place-items-center rounded-lg">
      <Icon aria-hidden size={20} />
    </span>
  );
}
