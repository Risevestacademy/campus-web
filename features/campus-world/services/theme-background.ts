const BACKGROUND_TOKEN = "--color-cobalt-100";
const FALLBACK_BACKGROUND = "#e9ecf6";
// KAPLAY parses only six-digit hex strings.
const KAPLAY_HEX = /^#[\da-f]{6}$/i;

export function campusBackground(
  theme: Pick<CSSStyleDeclaration, "getPropertyValue">,
): string {
  const token = theme.getPropertyValue(BACKGROUND_TOKEN).trim();
  return KAPLAY_HEX.test(token) ? token : FALLBACK_BACKGROUND;
}
