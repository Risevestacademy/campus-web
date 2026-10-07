import Image from "next/image";

import { IMAGES } from "@/assets/images";
import { CohortGate } from "@/features/auth";

export default async function ActiveCampusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <CohortGate cohortId={id}>
      <div className="relative grid place-content-center">
        <Image
          src={IMAGES.map}
          alt="Campus Map"
          fill
          sizes="100vw"
          className="size-full object-cover"
        />
        <div className="relative"></div>
      </div>
    </CohortGate>
  );
}
