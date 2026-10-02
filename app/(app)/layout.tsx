import { CampusShellGate } from "@/features/auth";

// Layouts keep their state across soft navigation, so every Campus page also
// sits behind its own CampusShellGate or requireRouteAccess call.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <CampusShellGate>{children}</CampusShellGate>;
}
