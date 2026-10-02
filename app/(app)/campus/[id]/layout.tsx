import { CampusMediaSessionProvider } from "@/features/campus";

export default function CampusLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <CampusMediaSessionProvider>{children}</CampusMediaSessionProvider>;
}
