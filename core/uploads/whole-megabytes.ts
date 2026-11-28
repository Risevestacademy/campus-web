const BINARY = 1024 * 1024;
const DECIMAL = 1_000_000;

// A size limit as the member reads it: whole megabytes, never "0 MB". A limit
// set in 1024s (25 MB as 26214400) reads as the number it was set to, and one
// set in round thousands as its own.
export function wholeMegabytes(bytes: number): string {
  const unit = bytes % BINARY === 0 ? BINARY : DECIMAL;
  return `${Math.max(1, Math.floor(bytes / unit))} MB`;
}
