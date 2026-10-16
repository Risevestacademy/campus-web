import { z } from "zod";

export const FIRST_PAGE = 1;

export const pageNumberSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.int());

const pageNumberOrFirst = pageNumberSchema.catch(FIRST_PAGE);

export function firstSearchParameter(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePageNumber(value: string | undefined): number {
  return pageNumberOrFirst.parse(value);
}
