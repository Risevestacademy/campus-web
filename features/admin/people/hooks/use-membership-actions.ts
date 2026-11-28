import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import {
  endMembership,
  extendGuestVisit,
  moveMemberTrack,
} from "../services/membership-actions.adapter";
import type {
  EndMembershipRequest,
  ExtendVisitRequest,
  MembershipEnd,
  MembershipEndProblem,
  MembershipMoveProblem,
  MoveTrackRequest,
  VisitExtendProblem,
} from "../types/people.types";

interface MembershipTarget {
  cohortId: string;
  userId: string;
  name: string;
  onDone: () => void;
}

const ENDED_TITLES: Readonly<Record<MembershipEnd, string>> = {
  graduate: "Marked as graduated",
  defer: "Marked as deferred",
  withdraw: "Marked as withdrawn",
  dismiss: "Dismissed from the cohort",
  remove: "Removed from the cohort",
};

export function useEndMembership({
  cohortId,
  userId,
  name,
  end,
  onDone,
}: MembershipTarget & { end: MembershipEnd }) {
  const { mutate, ...controls } = useAdminMutation<
    EndMembershipRequest,
    MembershipEndProblem
  >({
    mutationFn: (request) =>
      endMembership(browserApi, end, { cohortId, userId }, request),
    onSucceeded: () => {
      onDone();
      toast.add({
        title: ENDED_TITLES[end],
        description: name,
        type: "success",
      });
    },
  });

  return { end: mutate, ...controls };
}

export function useMoveMemberTrack({
  cohortId,
  userId,
  name,
  onDone,
}: MembershipTarget) {
  const { mutate, ...controls } = useAdminMutation<
    MoveTrackRequest,
    MembershipMoveProblem
  >({
    mutationFn: (request) =>
      moveMemberTrack(browserApi, { cohortId, userId }, request),
    onSucceeded: () => {
      onDone();
      toast.add({ title: "Track changed", description: name, type: "success" });
    },
  });

  return { move: mutate, ...controls };
}

export function useExtendGuestVisit({
  cohortId,
  userId,
  name,
  onDone,
}: MembershipTarget) {
  const { mutate, ...controls } = useAdminMutation<
    ExtendVisitRequest,
    VisitExtendProblem
  >({
    mutationFn: (request) =>
      extendGuestVisit(browserApi, { cohortId, userId }, request),
    onSucceeded: () => {
      onDone();
      toast.add({
        title: "Visit extended",
        description: name,
        type: "success",
      });
    },
  });

  return { extend: mutate, ...controls };
}
