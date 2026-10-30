import { useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CampusProvidersLayout from "./layout";

function CampusQueryProbe() {
  const { data } = useQuery({
    queryKey: ["campus-layout-provider"],
    queryFn: () => Promise.resolve("Campus query ready"),
  });

  return <output>{data ?? "Campus query pending"}</output>;
}

describe("CampusProvidersLayout", () => {
  it("provides query state to campus routes", async () => {
    render(
      <CampusProvidersLayout>
        <CampusQueryProbe />
      </CampusProvidersLayout>,
    );

    expect(await screen.findByText("Campus query ready")).toBeVisible();
  });
});
