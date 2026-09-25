export default function ActiveCampusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main>
      <aside>left actions</aside>
      <div>
        <aside>top actions</aside>
        {children}
        <aside>bottom actions</aside>
      </div>
    </main>
  );
}
