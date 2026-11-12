// Not success, error or warning: those are the status dots beside an avatar.
const AVATAR_TONE_CLASS_NAMES = {
  info: "bg-info-200 text-info-900",
  lemon: "bg-lemon-300 text-lemon-950",
  cobalt: "bg-cobalt-300 text-cobalt-950",
  turquoise: "bg-turquoise-300 text-turquoise-950",
} as const;

export type AvatarTone = keyof typeof AVATAR_TONE_CLASS_NAMES;

export const AVATAR_TONES = Object.values(AVATAR_TONE_CLASS_NAMES);

const UNKNOWN_INITIAL = "?";
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function initialOf(name: string | null | undefined): string {
  const [first] = graphemes.segment(name?.trim() ?? "");
  return first?.segment.toLocaleUpperCase() ?? UNKNOWN_INITIAL;
}

// The backend sends no avatar color, so a person's own ID picks theirs: the
// same everywhere and every session, unless a caller sets one.
export function avatarToneOf(id: string, tone?: AvatarTone): string {
  if (tone) return AVATAR_TONE_CLASS_NAMES[tone];
  let hash = 5381;
  for (const char of id) hash = (hash * 33 + char.codePointAt(0)!) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}
