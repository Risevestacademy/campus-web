import type { VideoDemand, VideoLayer } from "./contracts";

type Request = Readonly<{ participantId: string; layer: VideoLayer }>;

const LAYER_RANK: Readonly<Record<VideoLayer, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};

function largestLayers(requests: Iterable<Request>): VideoDemand {
  const demand = new Map<string, VideoLayer>();
  for (const { participantId, layer } of requests) {
    const current = demand.get(participantId);
    if (!current || LAYER_RANK[layer] > LAYER_RANK[current]) {
      demand.set(participantId, layer);
    }
  }
  return demand;
}

function sameDemand(left: VideoDemand, right: VideoDemand) {
  return (
    left.size === right.size &&
    [...left].every(
      ([participantId, layer]) => right.get(participantId) === layer,
    )
  );
}

// Requests settle in a microtask: React releases a tile's old ref before it
// attaches the new one, and forwarding each step would drop the camera and
// subscribe it again on every layout change.
export function createVideoDemand(onChange: (demand: VideoDemand) => void) {
  const requests = new Set<Request>();
  let forwarded: VideoDemand = new Map();
  let settling = false;

  function settle() {
    settling = false;
    const demand = largestLayers(requests);
    if (sameDemand(demand, forwarded)) return;
    forwarded = demand;
    onChange(demand);
  }

  function scheduleSettle() {
    if (settling) return;
    settling = true;
    queueMicrotask(settle);
  }

  return function demandVideo(participantId: string, layer: VideoLayer) {
    const request: Request = { participantId, layer };
    requests.add(request);
    scheduleSettle();
    return () => {
      requests.delete(request);
      scheduleSettle();
    };
  };
}
