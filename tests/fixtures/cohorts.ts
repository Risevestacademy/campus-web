import { fireEvent, screen, within } from "@testing-library/react";

export interface NewCohortInput {
  name?: string;
  code?: string;
  startDate?: string;
  endDate?: string;
  status?: "Upcoming" | "Active" | "Completed";
}

const createDialog = () =>
  within(screen.getByRole("dialog", { name: "Create a cohort" }));

export async function openCreateCohort() {
  fireEvent.click(screen.getByRole("button", { name: "Create cohort" }));
  await screen.findByRole("dialog", { name: "Create a cohort" });
  return createDialog();
}

export function fillNewCohort(input: NewCohortInput) {
  const dialog = createDialog();
  const fields = [
    ["Name", input.name],
    ["Code", input.code],
    ["Start date", input.startDate],
    ["End date", input.endDate],
  ] as const;

  for (const [label, value] of fields) {
    if (value !== undefined) {
      fireEvent.change(dialog.getByLabelText(label), { target: { value } });
    }
  }
  if (input.status) {
    fireEvent.click(dialog.getByRole("radio", { name: input.status }));
  }
}

export function submitNewCohort() {
  fireEvent.click(
    createDialog().getByRole("button", { name: /^(Create cohort|Creating…)$/ }),
  );
}
