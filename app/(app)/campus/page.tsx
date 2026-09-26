import Link from "next/link";

export default function CampusPage() {
  return (
    <div data-surface-role="background" className="bg-background space-y-8">
      <header
        data-surface-role="surface"
        className="bg-surface flex h-16 items-center px-10"
      >
        <Link href={"/"} className="flex items-center gap-3">
          <figure
            data-surface-role="surface"
            className="bg-surface size-10 rounded-xl"
          ></figure>
          <h1 className="font-medium">Campus</h1>
        </Link>
      </header>

      <div className="flex gap-8 px-10">
        {[1, 2].map((item) => (
          <div key={item} className="w-fit">
            <Link
              href={`/campus/${item}/join`}
              className="bg-surface border-border mb-2 block aspect-video w-80 rounded-2xl border"
            ></Link>
            <div className="flex items-center justify-between pl-2">
              <h3 className="font-medium">Cohort {item}</h3>
              <button className="bg-surface border-border size-10 rounded-xl border"></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
