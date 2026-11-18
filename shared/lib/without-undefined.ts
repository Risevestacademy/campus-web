// For create bodies: a key read as absent must not exist at all, or spreading
// the result over cached data would erase the cached value.
export function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}
