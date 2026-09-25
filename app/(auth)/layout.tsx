export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-surface-role="background"
      className="bg-background grid h-dvh grid-cols-[1fr_40rem]"
    >
      {children}
      <figure data-surface-role="surface" className="bg-surface"></figure>
    </div>
  );
}
