export function sum(...values: (number | undefined)[]): number | undefined {
  return values.every((value) => value !== undefined)
    ? values.reduce<number>((total, value) => total + (value ?? 0), 0)
    : undefined;
}

export function difference(
  whole: number | undefined,
  part: number | undefined,
): number | undefined {
  return whole === undefined || part === undefined ? undefined : whole - part;
}
