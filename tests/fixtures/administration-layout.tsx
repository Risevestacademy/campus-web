import type { ReactNode } from "react";

import AdministrationLayout from "@/app/campus/[id]/(administration)/layout";

export function administrationLayout(children: ReactNode = <div />) {
  return AdministrationLayout({
    children,
    params: Promise.resolve({ id: "c-1" }),
  });
}
