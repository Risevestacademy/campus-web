import { CaretUpIcon } from "@phosphor-icons/react/dist/ssr/CaretUp";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/ssr/Microphone";
import { VideoCameraIcon } from "@phosphor-icons/react/dist/ssr/VideoCamera";
import { cn } from "cn";
import Link from "next/link";

import { Button, buttonVariants } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/ui/button-group";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="grid h-dvh content-center gap-6">
      <section className="relative flex flex-col items-center justify-center">
        <figure className="bg-surface aspect-4/3 w-full max-w-160"></figure>

        <div className="*:bg-surface absolute bottom-3 flex w-fit items-center gap-6">
          <ButtonGroup className="*:[&_svg:not([class*='size-'])]:size-5">
            <Button size="icon" variant="ghost">
              <VideoCameraIcon />
            </Button>
            <div className="bg-border my-auto h-6 w-px"></div>
            <Button size="icon" variant="ghost" className="w-fit px-1.75">
              <CaretUpIcon className="size-4" />
            </Button>
          </ButtonGroup>

          <ButtonGroup className="*:[&_svg:not([class*='size-'])]:size-5">
            <Button size="icon" variant="ghost">
              <MicrophoneIcon />
            </Button>
            <div className="bg-border my-auto h-6 w-px"></div>
            <Button size="icon" variant="ghost" className="w-fit px-1.75">
              <CaretUpIcon className="size-4" />
            </Button>
          </ButtonGroup>
        </div>
      </section>

      <div className="mx-auto flex items-center gap-2">
        <Link
          href={`/campus/${id}`}
          className={cn(buttonVariants({ size: "lg" }), "min-w-40")}
        >
          Join
        </Link>
      </div>
    </main>
  );
}
