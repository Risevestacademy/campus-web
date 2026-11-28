import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import {
  reinstatePerson,
  setSystemRole,
  suspendPerson,
} from "../services/person-actions.adapter";
import type {
  AssignableSystemRole,
  PersonReinstateProblem,
  PersonRoleProblem,
  PersonSuspendProblem,
  SuspendRequest,
} from "../types/people.types";

interface PersonTarget {
  userId: string;
  name: string;
  onDone: () => void;
}

export function useSetSystemRole({
  userId,
  name,
  systemRole,
  onDone,
}: PersonTarget & { systemRole: AssignableSystemRole }) {
  const { mutate, ...controls } = useAdminMutation<void, PersonRoleProblem>({
    mutationFn: () => setSystemRole(browserApi, userId, systemRole),
    onSucceeded: () => {
      onDone();
      toast.add({
        title:
          systemRole === "admin" ? "Promoted to admin" : "Demoted from admin",
        description: name,
        type: "success",
      });
    },
  });

  return { change: () => mutate(), ...controls };
}

export function useSuspendPerson({ userId, name, onDone }: PersonTarget) {
  const { mutate, ...controls } = useAdminMutation<
    SuspendRequest,
    PersonSuspendProblem
  >({
    mutationFn: (request) => suspendPerson(browserApi, userId, request),
    onSucceeded: () => {
      onDone();
      toast.add({
        title: "Account suspended",
        description: name,
        type: "success",
      });
    },
  });

  return { suspend: mutate, ...controls };
}

export function useReinstatePerson({ userId, name, onDone }: PersonTarget) {
  const { mutate, ...controls } = useAdminMutation<
    void,
    PersonReinstateProblem
  >({
    mutationFn: () => reinstatePerson(browserApi, userId),
    onSucceeded: () => {
      onDone();
      toast.add({
        title: "Account reinstated",
        description: name,
        type: "success",
      });
    },
  });

  return { reinstate: () => mutate(), ...controls };
}
