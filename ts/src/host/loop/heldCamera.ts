import { copyMatchCamera, createMatchCamera, type MatchCamera } from "../../game/sim/matchCamera";

export interface HeldCamera {
  readonly camera: MatchCamera;
  readonly until: number;
  taken: boolean;
}

interface HeldCameraHost {
  readonly camera: MatchCamera;
  readonly runtime: { readonly simulationFrame: number };
  heldCamera: HeldCamera | undefined;
}

export function beginHeldCamera(host: HeldCameraHost, until: number): void {
  host.heldCamera = { camera: createMatchCamera(), until, taken: false };
}

export function applyHeldCamera(host: HeldCameraHost): void {
  const held = host.heldCamera;
  if (held === undefined) return;
  if (host.runtime.simulationFrame > held.until) host.heldCamera = undefined;
  else if (held.taken) copyMatchCamera(host.camera, held.camera);
  else {
    copyMatchCamera(held.camera, host.camera);
    held.taken = true;
  }
}
