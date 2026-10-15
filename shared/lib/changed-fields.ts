export type Patch<T> = {
  [Field in keyof T]?: undefined extends T[Field]
    ? Exclude<T[Field], undefined> | null
    : T[Field];
};

export function changedFields<T extends Record<string, unknown>>(
  current: Record<keyof T, unknown>,
  next: T,
): Patch<T> {
  const patch: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(next)) {
    const normalized = value ?? null;
    if (normalized !== current[field]) patch[field] = normalized;
  }
  return patch as Patch<T>;
}
