import { CampusShellGate } from "@/features/auth";

export default function ActiveCampusMeetingPage() {
  return (
    <CampusShellGate>
      <div className="grid place-content-center">
        <h1>ActiveCampusMeetingPage</h1>
      </div>
    </CampusShellGate>
  );
}
