import Image from "next/image";

import { IMAGES } from "@/assets/images";

export default async function ActiveCampusPage() {
  return (
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
  );
}
