export function redirect(href: string): never {
  throw new Error(`Unexpected redirect to ${href}`);
}

export function usePathname(): string {
  return "/campus/c-1";
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useRouter() {
  return { push() {} };
}
