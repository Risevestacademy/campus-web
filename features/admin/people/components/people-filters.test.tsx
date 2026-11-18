import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PeopleQuery, TrackOptionsRead } from "../types/people.types";
import { PeopleFilters } from "./people-filters";

const QUERY: PeopleQuery = {
  chip: "all",
  search: undefined,
  trackId: undefined,
  page: 1,
};
const TRACKS: TrackOptionsRead = {
  kind: "loaded",
  tracks: [{ id: "t-1", name: "Backend" }],
};

describe("PeopleFilters", () => {
  it("points at the People page with a search box and a Track select", () => {
    render(<PeopleFilters cohortId="c-1" query={QUERY} tracks={TRACKS} />);

    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/campus/c-1/people");
    expect(
      within(form).getByRole("searchbox", { name: "Search by name or email" }),
    ).toHaveAttribute("name", "q");
    expect(within(form).getByRole("combobox")).toHaveAttribute("name", "track");
  });

  it("keeps the chosen role and the current search and Track in the form", () => {
    render(
      <PeopleFilters
        cohortId="c-1"
        query={{ ...QUERY, chip: "mentor", search: "ada", trackId: "t-1" }}
        tracks={TRACKS}
      />,
    );

    const fields = new FormData(screen.getByRole("search") as HTMLFormElement);
    expect(Object.fromEntries(fields)).toEqual({
      role: "mentor",
      q: "ada",
      track: "t-1",
    });
  });

  it("offers no Track select when the tracks could not be read", () => {
    render(
      <PeopleFilters
        cohortId="c-1"
        query={QUERY}
        tracks={{ kind: "unavailable" }}
      />,
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
