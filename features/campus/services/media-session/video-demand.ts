import {
  NO_VIDEO_DEMAND,
  type VideoDemand,
  type VideoLayer,
  type VideoSource,
} from "./contracts";

type VideoRequest = Readonly<{
  layer: VideoLayer;
  participantId: string;
  source: VideoSource;
}>;

const LAYER_RANK: Readonly<Record<VideoLayer, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};

function largestLayers(requests: Iterable<VideoRequest>): VideoDemand {
  const demand = {
    camera: new Map<string, VideoLayer>(),
    screen: new Map<string, VideoLayer>(),
  };
  for (const { participantId, layer, source } of requests) {
    const current = demand[source].get(participantId);
    if (!current || LAYER_RANK[layer] > LAYER_RANK[current]) {
      demand[source].set(participantId, layer);
    }
  }
  return demand;
}

function sameLayers(
  left: ReadonlyMap<string, VideoLayer>,
  right: ReadonlyMap<string, VideoLayer>,
) {
  return (
    left.size === right.size &&
    [...left].every(
      ([participantId, layer]) => right.get(participantId) === layer,
    )
  );
}

function sameDemand(left: VideoDemand, right: VideoDemand) {
  return (
    sameLayers(left.camera, right.camera) &&
    sameLayers(left.screen, right.screen)
  );
}

// Requests settle in a microtask: React releases a tile's old ref before it
// attaches the new one, and forwarding each step would drop the video and
// subscribe it again on every layout change.
export function createVideoDemand(onChange: (demand: VideoDemand) => void) {
  const requests = new Set<VideoRequest>();
  let forwarded: VideoDemand = NO_VIDEO_DEMAND;
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

  return function demandVideo(
    participantId: string,
    source: VideoSource,
    layer: VideoLayer,
  ) {
    const request: VideoRequest = { layer, participantId, source };
    requests.add(request);
    scheduleSettle();
    return () => {
      requests.delete(request);
      scheduleSettle();
    };
  };
}
