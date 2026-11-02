import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { SIGN_IN_PATH } from "@/core/navigation";
import { replaceDocument } from "@/shared/lib/document-navigation";

// `kind` is never read here, but without a required member TypeScript rejects
// success outcomes such as `{ kind: "updated" }` as sharing no properties.
interface AdminMutationOutcome<TProblem extends string> {
  kind: string;
  problem?: TProblem;
}

interface AdminMutationOptions<
  TVariables,
  TProblem extends string,
  TOutcome extends AdminMutationOutcome<TProblem>,
> {
  mutationFn: (variables: TVariables) => Promise<TOutcome>;
  // The outcome is the one the request returned, so a caller reads what it
  // needs from it instead of keeping a copy on the side.
  onSucceeded: (variables: TVariables, outcome: TOutcome) => void;
  // A function lets an outcome opt out, for one that must leave the page as it
  // is, such as a popup still holding work the user has to retry.
  refreshAfterSuccess?: boolean | ((outcome: TOutcome) => boolean);
}

export function useAdminMutation<
  TVariables,
  TProblem extends string,
  TOutcome extends AdminMutationOutcome<TProblem> =
    AdminMutationOutcome<TProblem>,
>({
  mutationFn,
  onSucceeded,
  refreshAfterSuccess = true,
}: AdminMutationOptions<TVariables, TProblem, TOutcome>) {
  const router = useRouter();
  const inFlight = useRef(false);

  const mutation = useMutation({
    mutationFn,
    // A retried request whose first response was lost can duplicate the
    // record or answer 409 for one that now exists.
    retry: false,
    onSuccess: (outcome, variables) => {
      if (outcome.problem === "signed-out") {
        replaceDocument(SIGN_IN_PATH);
        return;
      }
      if (outcome.problem) return;

      onSucceeded(variables, outcome);
      const refresh =
        typeof refreshAfterSuccess === "function"
          ? refreshAfterSuccess(outcome)
          : refreshAfterSuccess;
      if (refresh) router.refresh();
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  function mutate(variables: TVariables) {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.reset();
    mutation.mutate(variables);
  }

  return {
    mutate,
    isPending: mutation.isPending,
    problem: mutation.data?.problem,
    reset: mutation.reset,
  };
}
