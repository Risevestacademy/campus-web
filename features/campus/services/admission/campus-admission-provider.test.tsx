import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CampusAdmissionProvider,
  useCampusAdmission,
} from "./campus-admission-provider";

function AdmissionProbe() {
  const pendingDestination = useCampusAdmission(
    (state) => state.pendingActiveCampusDestination,
  );
  const grantActiveCampusEntry = useCampusAdmission(
    (state) => state.grantActiveCampusEntry,
  );

  return (
    <>
      <button
        onClick={() => grantActiveCampusEntry("/campus/c-1")}
        type="button"
      >
        Grant entry
      </button>
      <output aria-label="Pending entry">{pendingDestination ?? "none"}</output>
    </>
  );
}

describe("CampusAdmissionProvider", () => {
  it("preserves its document-scoped store when the provider remounts", () => {
    const firstMount = render(
      <CampusAdmissionProvider>
        <AdmissionProbe />
      </CampusAdmissionProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Grant entry" }));
    firstMount.unmount();

    render(
      <CampusAdmissionProvider>
        <AdmissionProbe />
      </CampusAdmissionProvider>,
    );

    expect(screen.getByLabelText("Pending entry")).toHaveTextContent(
      "/campus/c-1",
    );
  });
});
