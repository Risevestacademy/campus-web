import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { replaceDocument } from "@/shared/lib/document-navigation";

const SIGN_IN_PATH = "/sign-in";

// `kind` is never read here, but without a required member TypeScript rejects
// success outcomes such as `{ kind: "updated" }` as sharing no properties.
interface AdminMutationOutcome<TProblem extends string> {
  kind: string;
  problem?: TProblem;
}

interface AdminMutationOptions<TVariables, TProblem extends string> {
  mutationFn: (
    variables: TVariables,
  ) => Promise<AdminMutationOutcome<TProblem>>;
  onSucceeded: (variables: TVariables) => void;
  refreshAfterSuccess?: boolean;
}

export function useAdminMutation<TVariables, TProblem extends string>({
  mutationFn,
  onSucceeded,
  refreshAfterSuccess = true,
}: AdminMutationOptions<TVariables, TProblem>) {
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

      onSucceeded(variables);
      if (refreshAfterSuccess) router.refresh();
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
