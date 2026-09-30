import {
  CampusControlBar,
  MeetingHeader,
  MeetingViewControls,
} from "@/features/campus";

const meetingParticipants = [
  { id: "participant-a", initials: "A", name: "Participant A" },
  { id: "participant-j", initials: "J", name: "Participant J" },
] as const;

export default function ActiveCampusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      data-surface-role="background"
      className="bg-background text-foreground flex h-dvh"
    >
      <aside id="left-actions" className="px-1.5 py-3">
        <figure
          data-surface-role="surface"
          className="bg-surface aspect-square size-12 rounded-xl"
        ></figure>
      </aside>

      <div className="flex flex-1 p-1.5 pl-0">
        <div className="bg-cobalt-500/10 grid flex-1 grid-rows-[auto_1fr_auto] rounded-xl">
          <div className="relative z-1">
            <aside
              id="top-actions"
              className="absolute inset-x-0 top-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 p-2.5"
            >
              <div className="relative z-30">
                <MeetingHeader
                  title="Title for meeting"
                  participants={meetingParticipants}
                  remainingParticipantCount={2}
                />
              </div>
              <MeetingViewControls participants={meetingParticipants} />
            </aside>
          </div>

          {children}

          <div className="relative z-1">
            <aside
              id="bottom-actions"
              aria-label="Campus controls"
              data-layout-anchor="campus-controls"
              className="absolute inset-x-0 bottom-0 p-2.5"
            >
              <CampusControlBar initials="AJ" status="active" />
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
