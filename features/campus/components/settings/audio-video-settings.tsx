"use client";

import { MicrophoneIcon } from "@phosphor-icons/react/dist/ssr/Microphone";
import { SpeakerHighIcon } from "@phosphor-icons/react/dist/ssr/SpeakerHigh";
import { StopIcon } from "@phosphor-icons/react/dist/ssr/Stop";
import { VideoCameraIcon } from "@phosphor-icons/react/dist/ssr/VideoCamera";
import { VideoCameraSlashIcon } from "@phosphor-icons/react/dist/ssr/VideoCameraSlash";
import { type ReactNode, useCallback, useId } from "react";

import { useMountEffect } from "@/shared/lib/use-mount-effect";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/native-select";
import { Switch } from "@/shared/ui/switch";

import { type DeviceTest, useDeviceTest } from "../../hooks/use-device-test";
import { useMicrophoneLevelRef } from "../../hooks/use-microphone-level-ref";
import { useSpeakerTest } from "../../hooks/use-speaker-test";
import type {
  CaptureSource,
  CaptureSourceState,
  LocalMediaPublication,
  MediaDeviceOption,
} from "../../services/media-session/contracts";
import { useMediaSession } from "../../services/media-session/media-session-provider";
import {
  describeBlockedAccess,
  describeSourceFailure,
  reportSpeakerResult,
  reportSwitchResult,
} from "../media-error-feedback";
import { MediaPublicationOutput } from "../media-publication-output";
import { SettingsSectionHeading, SettingsSwitchRow } from "./settings-row";

type TestControls = ReturnType<typeof useDeviceTest>;

// Sits beside a select, so it matches the select's height, border and text.
const FIELD_BUTTON =
  "border-input bg-popover h-11 shrink-0 rounded-lg px-4 text-sm font-medium dark:bg-input/30";

// Why a device can't be listed or tested, when that is the case.
function captureNotice(
  source: CaptureSource,
  state: CaptureSourceState,
): string | null {
  if (state.error === "unsupported") {
    return `This browser can't use a ${source}.`;
  }
  if (state.error === "permission-denied" && !state.track) {
    const blocked = describeBlockedAccess(source);
    return `${blocked.title}. ${blocked.description}`;
  }
  return null;
}

function testFailure(source: CaptureSource, test: DeviceTest) {
  if (!test.error) return null;
  const failure = describeSourceFailure(source, test.error);
  return `${failure.title}. ${failure.description}`;
}

function Problem({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-error-foreground text-sm">
      {children}
    </p>
  );
}

// One device: its name and purpose on the left, its controls on the right,
// ruled off like the switch rows below. Stacks on narrow screens.
function DeviceRow({
  children,
  description,
  htmlFor,
  title,
}: {
  children: ReactNode;
  description: string;
  htmlFor: string;
  title: string;
}) {
  return (
    <div className="border-border grid gap-x-8 gap-y-3 border-b py-5 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-1">
        <Label htmlFor={htmlFor} className="text-[15px] font-semibold">
          {title}
        </Label>
        <p className="text-foreground-secondary text-sm">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </div>
  );
}

function DeviceSelect({
  devices,
  emptyLabel,
  id,
  noticeId,
  onSelect,
  selectedDeviceId,
  unavailable,
}: {
  devices: readonly MediaDeviceOption[];
  emptyLabel: string;
  id: string;
  noticeId?: string;
  onSelect: (deviceId: string) => void;
  selectedDeviceId: string;
  unavailable?: boolean;
}) {
  const hasDevices = devices.length > 0;
  // With nothing chosen yet the browser uses its default device, so the
  // list shows that one rather than asking.
  const shownDeviceId = devices.some(
    ({ id: device }) => device === selectedDeviceId,
  )
    ? selectedDeviceId
    : ((devices.find(({ isDefault }) => isDefault) ?? devices[0])?.id ?? "");

  return (
    <NativeSelect
      id={id}
      disabled={!hasDevices || unavailable}
      aria-describedby={noticeId}
      value={shownDeviceId}
      onChange={(event) => onSelect(event.target.value)}
    >
      {hasDevices ? (
        devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.label}
          </option>
        ))
      ) : (
        <option value="">{emptyLabel}</option>
      )}
    </NativeSelect>
  );
}

// Shows the test capture without publishing it.
function TestVideo({ track }: { track: MediaStreamTrack }) {
  const videoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      if (!element) return;
      element.srcObject = new MediaStream([track]);
      return () => {
        element.srcObject = null;
      };
    },
    [track],
  );

  return (
    <video
      ref={videoRef}
      aria-label="Camera preview"
      autoPlay
      muted
      playsInline
      className="size-full -scale-x-100 object-cover"
    />
  );
}

// The call's own camera when it is on; otherwise a preview the member starts
// from the frame itself.
function CameraPreview({
  camera,
  publication,
  test,
}: {
  camera: CaptureSourceState;
  publication: LocalMediaPublication | undefined;
  test: TestControls;
}) {
  const isCallCameraOn = Boolean(
    publication?.enabled && publication.track.readyState === "live",
  );
  const cannotPreview = camera.error === "unsupported";

  return (
    <figure className="bg-surface relative m-0 aspect-[2/1] overflow-hidden rounded-xl">
      {isCallCameraOn ? (
        <MediaPublicationOutput
          fallbackLabel="Camera on"
          label="Camera preview"
          videoPublication={publication}
        />
      ) : test.track ? (
        <>
          <TestVideo track={test.track} />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute top-3 right-3 bg-black/55 text-white backdrop-blur-sm hover:bg-black/70"
            onClick={test.stop}
          >
            <StopIcon aria-hidden weight="fill" data-icon="inline-start" />
            Stop preview
          </Button>
        </>
      ) : (
        <div className="text-foreground-secondary flex size-full flex-col items-center justify-center gap-3 text-sm">
          <VideoCameraSlashIcon
            aria-hidden
            className="text-icon-muted size-7"
          />
          <Button
            type="button"
            variant="outline"
            className={FIELD_BUTTON}
            disabled={test.isStarting || cannotPreview}
            onClick={test.start}
          >
            <VideoCameraIcon aria-hidden data-icon="inline-start" />
            {test.isStarting ? "Starting camera…" : "Preview camera"}
          </Button>
        </div>
      )}
      {isCallCameraOn ? (
        <figcaption className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
          On in the call
        </figcaption>
      ) : null}
    </figure>
  );
}

const LEVEL_SEGMENTS =
  "[mask-image:repeating-linear-gradient(90deg,#000_0_5px,transparent_5px_8px)]";

// The fill follows --mic-level, which the meter writes straight to the
// element every frame, so the level never re-renders React. It stays shown
// with reduced motion: it is how the member checks they can be heard.
function MicrophoneLevel({ track }: { track: MediaStreamTrack | null }) {
  const levelRef = useMicrophoneLevelRef(track);

  return (
    <div
      ref={levelRef}
      aria-hidden
      className={`bg-border relative h-2 w-full overflow-hidden ${LEVEL_SEGMENTS}`}
    >
      <div className="bg-secondary absolute inset-y-0 left-0 w-[calc(var(--mic-level,0)*100%)]" />
    </div>
  );
}

function MicrophoneCheck({
  microphone,
  test,
}: {
  microphone: CaptureSourceState;
  test: TestControls;
}) {
  const isCallMicrophoneOn = Boolean(microphone.track?.enabled);
  const isListening = isCallMicrophoneOn || test.track !== null;

  return (
    <div className="flex flex-col gap-2">
      <MicrophoneLevel
        track={isCallMicrophoneOn ? microphone.track : test.track}
      />
      <p className="text-foreground-secondary text-sm" aria-live="polite">
        {isListening
          ? "Speak: the bar moves when Campus can hear you."
          : "Check your microphone before you join a room."}
      </p>
    </div>
  );
}

export function AudioVideoSettings() {
  const camera = useMediaSession((state) => state.camera);
  const cameraPublication = useMediaSession(
    (state) => state.localPublications.camera,
  );
  const microphone = useMediaSession((state) => state.microphone);
  const output = useMediaSession((state) => state.output);
  const deviceDiscoveryStatus = useMediaSession(
    (state) => state.deviceDiscoveryStatus,
  );
  const refreshDevices = useMediaSession((state) => state.refreshDevices);
  const selectInputDevice = useMediaSession((state) => state.selectInputDevice);
  const selectOutputDevice = useMediaSession(
    (state) => state.selectOutputDevice,
  );
  const chooseAudioOutput = useMediaSession((state) => state.chooseAudioOutput);
  const cameraTest = useDeviceTest("camera");
  const microphoneTest = useDeviceTest("microphone");
  const speakerTest = useSpeakerTest(output.selectedDeviceId);
  const cameraId = useId();
  const microphoneId = useId();
  const speakerId = useId();
  const cameraNoticeId = useId();
  const microphoneNoticeId = useId();
  const micOffId = useId();
  const cameraOffId = useId();
  const noiseId = useId();

  const isDiscovering =
    deviceDiscoveryStatus === "idle" || deviceDiscoveryStatus === "loading";
  const discoveryFailed = deviceDiscoveryStatus === "failed";
  const cameraNotice = captureNotice("camera", camera);
  const microphoneNotice = captureNotice("microphone", microphone);
  const cameraFailure = testFailure("camera", cameraTest);
  const microphoneFailure = testFailure("microphone", microphoneTest);
  const isCallMicrophoneOn = Boolean(microphone.track?.enabled);

  function emptyLabel(source: CaptureSource, state: CaptureSourceState) {
    if (isDiscovering) return `Looking for ${source}s…`;
    if (discoveryFailed) return `No ${source}s available right now`;
    if (state.devicesRequirePermission) {
      return `Allow ${source} access to choose one`;
    }
    return `No ${source}s found`;
  }

  // Devices plugged in since the last look show up when Settings opens.
  useMountEffect(() => {
    void refreshDevices();
  });

  async function selectCamera(deviceId: string) {
    const hadActiveTrack = Boolean(camera.track);
    const error = await selectInputDevice("camera", deviceId);
    reportSwitchResult("camera", error, hadActiveTrack);
    cameraTest.restartIfRunning();
  }

  async function selectMicrophone(deviceId: string) {
    const hadActiveTrack = Boolean(microphone.track);
    const error = await selectInputDevice("microphone", deviceId);
    reportSwitchResult("microphone", error, hadActiveTrack);
    microphoneTest.restartIfRunning();
  }

  async function chooseSpeaker() {
    reportSpeakerResult(await chooseAudioOutput());
  }

  return (
    <>
      <SettingsSectionHeading
        title="Audio & video"
        description="The devices Campus uses when you join a room or a meeting. Tests stay on this device."
      />

      <div className="border-border border-t">
        <DeviceRow
          htmlFor={cameraId}
          title="Camera"
          description="What people see when your camera is on."
        >
          <CameraPreview
            camera={camera}
            publication={cameraPublication}
            test={cameraTest}
          />
          <DeviceSelect
            id={cameraId}
            devices={camera.devices}
            selectedDeviceId={camera.selectedDeviceId}
            emptyLabel={emptyLabel("camera", camera)}
            unavailable={Boolean(cameraNotice)}
            noticeId={cameraNotice ? cameraNoticeId : undefined}
            onSelect={(deviceId) => void selectCamera(deviceId)}
          />
          {cameraNotice ? (
            <p
              id={cameraNoticeId}
              className="text-foreground-secondary text-sm"
            >
              {cameraNotice}
            </p>
          ) : null}
          {cameraFailure ? <Problem>{cameraFailure}</Problem> : null}
        </DeviceRow>

        <DeviceRow
          htmlFor={microphoneId}
          title="Microphone"
          description="How people hear you."
        >
          <div className="flex gap-2">
            <DeviceSelect
              id={microphoneId}
              devices={microphone.devices}
              selectedDeviceId={microphone.selectedDeviceId}
              emptyLabel={emptyLabel("microphone", microphone)}
              unavailable={Boolean(microphoneNotice)}
              noticeId={microphoneNotice ? microphoneNoticeId : undefined}
              onSelect={(deviceId) => void selectMicrophone(deviceId)}
            />
            {isCallMicrophoneOn ? null : (
              <Button
                type="button"
                variant="outline"
                className={FIELD_BUTTON}
                aria-label={
                  microphoneTest.track
                    ? "Stop microphone test"
                    : "Test microphone"
                }
                disabled={
                  microphoneTest.isStarting ||
                  microphone.error === "unsupported"
                }
                onClick={
                  microphoneTest.track
                    ? microphoneTest.stop
                    : microphoneTest.start
                }
              >
                {microphoneTest.track ? (
                  <StopIcon
                    aria-hidden
                    weight="fill"
                    data-icon="inline-start"
                  />
                ) : (
                  <MicrophoneIcon aria-hidden data-icon="inline-start" />
                )}
                {microphoneTest.track ? "Stop" : "Test"}
              </Button>
            )}
          </div>
          <MicrophoneCheck microphone={microphone} test={microphoneTest} />
          {microphoneNotice ? (
            <p
              id={microphoneNoticeId}
              className="text-foreground-secondary text-sm"
            >
              {microphoneNotice}
            </p>
          ) : null}
          {microphoneFailure ? <Problem>{microphoneFailure}</Problem> : null}
        </DeviceRow>

        <DeviceRow
          htmlFor={speakerId}
          title="Speaker"
          description="Where you hear the room."
        >
          <div className="flex gap-2">
            <DeviceSelect
              id={speakerId}
              devices={output.devices}
              selectedDeviceId={output.selectedDeviceId}
              emptyLabel="System default speaker"
              onSelect={selectOutputDevice}
            />
            <Button
              type="button"
              variant="outline"
              className={FIELD_BUTTON}
              aria-label="Play test sound"
              disabled={speakerTest.status === "playing"}
              onClick={speakerTest.play}
            >
              <SpeakerHighIcon aria-hidden data-icon="inline-start" />
              {speakerTest.status === "playing" ? "Playing…" : "Test"}
            </Button>
          </div>
          {output.supportsSelection ? (
            <Button
              type="button"
              variant="link"
              className="h-auto self-start p-0"
              onClick={() => void chooseSpeaker()}
            >
              Choose another speaker…
            </Button>
          ) : null}
          {speakerTest.status === "failed" ? (
            <Problem>
              Couldn&apos;t play the test sound on this speaker.
            </Problem>
          ) : null}
        </DeviceRow>
      </div>

      {/* Joining muted is not built yet, and capture always suppresses noise:
          these switches show the settings without changing them. */}
      <h4 className="mt-8 mb-1 text-sm font-semibold">When you join</h4>
      <div>
        <SettingsSwitchRow
          htmlFor={micOffId}
          label="Join with microphone off"
          description="Rooms and meetings start with you muted."
          control={<Switch id={micOffId} checked={false} disabled />}
        />
        <SettingsSwitchRow
          htmlFor={cameraOffId}
          label="Join with camera off"
          description="Turn your camera on yourself once you are in."
          control={<Switch id={cameraOffId} checked={false} disabled />}
        />
        <SettingsSwitchRow
          htmlFor={noiseId}
          label="Noise suppression"
          description="Always on: filters out keyboard and background noise."
          control={<Switch id={noiseId} checked disabled />}
        />
      </div>
    </>
  );
}
