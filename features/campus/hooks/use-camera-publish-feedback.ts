import { useMountEffect } from "@/shared/lib/use-mount-effect";
import { toast } from "@/shared/ui/toast";

import { useMediaSessionStore } from "../services/media-session/media-session-provider";

const CAMERA_PUBLISH_TOAST_ID = "call-camera";

function closeCameraPublishFeedback() {
  toast.close(CAMERA_PUBLISH_TOAST_ID);
}

// A warning, not an error: the call carries on, only the camera is missing.
function reportCameraPublish(failed: boolean) {
  if (!failed) {
    closeCameraPublishFeedback();
    return;
  }

  toast.add({
    description:
      "People nearby can still hear you. Turn your camera off and on to try again.",
    id: CAMERA_PUBLISH_TOAST_ID,
    priority: "high",
    timeout: 0,
    title: "Your camera isn't reaching the call",
    type: "warning",
  });
}

export function useCameraPublishFeedback() {
  const store = useMediaSessionStore();

  useMountEffect(() => {
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.cameraPublishFailed === previous.cameraPublishFailed) return;
      reportCameraPublish(state.cameraPublishFailed);
    });

    return () => {
      unsubscribe();
      closeCameraPublishFeedback();
    };
  });
}
