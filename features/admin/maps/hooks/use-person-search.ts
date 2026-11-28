import { skipToken, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { browserApi } from "@/core/api/client/browser";

import { listPeople } from "../../people/services/people-api.adapter";

const RESULTS = 6;
const SETTLE_MS = 250;
const MIN_LENGTH = 2;

// People in the cohort whose name or email matches. The search runs once
// typing settles, so a name is one request rather than one per letter.
export function usePersonSearch(cohortId: string) {
  const [text, setText] = useState("");
  const [settled, setSettled] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function type(next: string) {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSettled(next.trim()), SETTLE_MS);
  }

  const query = useQuery({
    queryKey: ["maps", "person-search", cohortId, settled],
    queryFn:
      settled.length < MIN_LENGTH
        ? skipToken
        : () =>
            listPeople(browserApi, cohortId, { search: settled }, 1, RESULTS),
    retry: false,
  });

  return {
    text,
    type,
    ready: settled.length >= MIN_LENGTH,
    read: query.data,
    isLoading: query.isFetching,
  };
}
