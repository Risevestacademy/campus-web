import { Providers } from "../providers";

export default function CampusProvidersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
