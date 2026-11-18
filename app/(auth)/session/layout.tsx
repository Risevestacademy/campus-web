export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-surface-role="background" className="bg-background grid h-dvh">
      <main
        className="content-grid content-center items-center"
        style={{ "--content-max-width": "37rem" } as React.CSSProperties}
      >
        {children}
      </main>
    </div>
  );
}
