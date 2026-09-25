import Link from "next/link";

export default function CampusPage() {
  return (
    <div className="space-y-8">
      <header className="bg-surface flex h-16 items-center gap-3 px-10">
        <figure className="bg-background size-10 rounded-xl"></figure>{" "}
        <h1 className="font-medium">Campus</h1>
      </header>

      <div className="flex gap-8 px-10">
        {[1, 2].map((item) => (
          <div key={item} className="w-fit">
            <Link
              href={`/campus/${item}`}
              className="bg-surface/50 border-surface-elevated mb-2 block aspect-video w-80 rounded-2xl border"
            ></Link>
            <div className="flex items-center justify-between pl-2">
              <h3 className="font-medium">Cohort {item}</h3>
              <button className="bg-surface/50 border-surface-elevated size-10 rounded-xl border"></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
