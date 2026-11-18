// KAPLAY reads `[tag]` as a style and `\x` as a literal x, and throws on an
// unclosed tag or a trailing `\`. A throw mid-frame fails the whole map, so a
// display name must never reach drawText unescaped.
export function escapeStyledText(text: string): string {
  return text.replace(/[\\[]/g, "\\$&");
}
