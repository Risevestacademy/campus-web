export const FIELD_CLASS =
  "h-11 rounded-xl px-4 text-base focus-visible:border-[#3155D6] dark:border-[#2B3B5F] dark:focus-visible:border-[#3155D6]";

export function FieldError({ message }: { message: string | undefined }) {
  return message ? (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  ) : null;
}
