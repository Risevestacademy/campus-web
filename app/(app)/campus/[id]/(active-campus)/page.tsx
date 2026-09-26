export default async function ActiveCampusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="grid place-content-center">
      <h1>ActiveCampus {id}</h1>
      <p>The Campus View and map</p>
    </div>
  );
}
