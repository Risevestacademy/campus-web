import { DecorativeCirclesSVG } from "@/assets/svgs/decorative-circles";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-surface-role="background"
      className="bg-background grid h-dvh xl:grid-cols-[1fr_30rem]"
    >
      <main
        className="content-grid content-center items-center"
        style={{ "--content-max-width": "37rem" } as React.CSSProperties}
      >
        {children}
      </main>
      <section
        data-surface-role="primary"
        className="bg-primary grid h-full content-center justify-items-center gap-16 px-15 text-center text-white max-xl:hidden"
      >
        <h2 className="font-display text-5xl font-bold">
          Your Cohort is waiting
        </h2>
        <figure className="size-70">
          <DecorativeCirclesSVG />
        </figure>
        <p>
          Classes, conversations and support. <br /> All in one shared place.
        </p>
      </section>
    </div>
  );
}
