export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid h-dvh grid-cols-[1fr_40rem]">
      {children}
      <figure className="bg-surface/50"></figure>
    </div>
  );
}
