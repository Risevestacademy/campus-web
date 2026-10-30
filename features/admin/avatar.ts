const AVATAR_TONES = [
  "bg-info-200 text-info-900",
  "bg-lemon-300 text-lemon-950",
  "bg-cobalt-300 text-cobalt-950",
  "bg-success-300 text-success-950",
  "bg-error-300 text-error-950",
] as const;

export function initialOf(name: string): string {
  return name.charAt(0).toUpperCase();
}

// The tone follows the id, so a person keeps their color wherever the admin
// pages draw them.
export function avatarTone(id: string): string {
  const sum = Array.from(id).reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );
  return AVATAR_TONES[sum % AVATAR_TONES.length] ?? AVATAR_TONES[0];
}
