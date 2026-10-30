import { f32 } from "wisp/src/sim/f32";
import { ARENA_CAMERA, WORLD_BOUNDS } from "../../game/presentation/arenaCamera";
import { copyMatchCamera, createMatchCamera, limitCamera, type MatchCamera } from "../../game/sim/matchCamera";
import { stageBounds } from "../../game/sim/stageBounds";
import { surfaceLeft, surfaceRight, surfaceZ } from "../../game/sim/stage";
import { Phase, stageClock } from "../../game/lobby/lobbyState";
import type { ShellState } from "./state";
import { Action } from "../../game/input/actions";
import { type KeyBindings, inputAction } from "../../game/input/keyBindings";
import { chordAction, pausedInputKeys } from "../../game/input/pauseChord";

export interface PauseCamera {
  readonly saved: MatchCamera;
  readonly aspect: number;
  tilt: number;
  hideHud: boolean;
  readonly held: Map<number, number>;
}

export const CameraControl = { left: 0, right: 1, up: 2, down: 3, zoomIn: 4, zoomOut: 5, tiltUp: 6, tiltDown: 7, hideHud: 8 } as const;
type CameraControl = (typeof CameraControl)[keyof typeof CameraControl];

const LEGACY_KEYS: Readonly<Record<number, CameraControl>> = {
  0x25: CameraControl.left, 0x26: CameraControl.up, 0x27: CameraControl.right, 0x28: CameraControl.down,
  0x4a: CameraControl.left, 0x4c: CameraControl.right, 0x49: CameraControl.up, 0x4b: CameraControl.down,
  0xbb: CameraControl.zoomIn, 0x6b: CameraControl.zoomIn, 0xbd: CameraControl.zoomOut, 0x6d: CameraControl.zoomOut,
  0x4f: CameraControl.tiltUp, 0x50: CameraControl.tiltDown, 0x47: CameraControl.hideHud,
};

const ACTION_CONTROLS: Readonly<Record<number, CameraControl>> = {
  [Action.moveLeft]: CameraControl.left, [Action.moveRight]: CameraControl.right, [Action.moveUp]: CameraControl.up, [Action.moveDown]: CameraControl.down,
  [Action.cUp]: CameraControl.zoomIn, [Action.cDown]: CameraControl.zoomOut,
};

// A key bound to an action keeps that action's meaning; only unbound keys fall back to the fixed camera keys (the typed journal path passes no bindings).
export function pauseCameraControl(bindings: Readonly<KeyBindings> | undefined, key: number): CameraControl | undefined {
  const action = bindings === undefined ? undefined : inputAction(bindings, key);
  return action === undefined ? LEGACY_KEYS[key] : ACTION_CONTROLS[action];
}

export const pausedKeyUsed = (bindings: Readonly<KeyBindings>, key: number): boolean => pauseCameraControl(bindings, key) !== undefined || chordAction(bindings, key) !== undefined;
export const pauseHeldKeys = (bindings: Readonly<KeyBindings>): number[] => pausedInputKeys(bindings);
export const pauseHudHidden = (s: Readonly<ShellState>): boolean => (s.build.devConsole && s.promoHudHidden === true) || (s.session.paused && s.pauseCamera?.hideHud === true);

export function beginPauseCamera(s: ShellState, aspect: number): void {
  if (s.pauseCamera !== undefined) return;
  const saved = createMatchCamera();
  copyMatchCamera(saved, s.camera);
  s.pauseCamera = { saved, aspect, tilt: 0.0, hideHud: false, held: new Map() };
}

export function cameraKey(s: ShellState, bindings: Readonly<KeyBindings> | undefined, key: number, down: boolean): boolean {
  const control = pauseCameraControl(bindings, key);
  if (control === undefined || !s.session.paused || s.game.phase !== Phase.match) return false;
  const camera = s.pauseCamera;
  if (camera === undefined) return true;
  if (!down) camera.held.delete(key);
  else if (control === CameraControl.hideHud) {
    if (!camera.held.has(key)) camera.hideHud = !camera.hideHud;
    camera.held.set(key, control);
  } else if (!camera.held.has(key)) {
    camera.held.set(key, control);
    advancePauseCamera(s, camera.aspect);
  }
  return true;
}

export function advancePauseCamera(s: ShellState, aspect: number): void {
  const camera = s.pauseCamera;
  if (camera === undefined) return;
  const counts: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  camera.held.forEach(control => { counts[control] = 1; });
  const held = (control: CameraControl): number => counts[control] ?? 0;
  const x = held(CameraControl.right) - held(CameraControl.left);
  const z = held(CameraControl.up) - held(CameraControl.down);
  const zoom = held(CameraControl.zoomOut) - held(CameraControl.zoomIn);
  const tilt = held(CameraControl.tiltUp) - held(CameraControl.tiltDown);
  if (x === 0 && z === 0 && zoom === 0 && tilt === 0) return;
  s.camera.x = f32(s.camera.x + x * 12.0);
  s.camera.z = f32(s.camera.z + z * 12.0);
  s.camera.distance = Math.max(498.0, f32(s.camera.distance + zoom * 24.0));
  camera.tilt = Math.min(15.0, Math.max(-25.0, f32(camera.tilt + tilt * 0.5)));
  const bounds = stageBounds(s.game.stageChoice);
  limitCamera(s.camera, bounds.camera, aspect, bounds.blast.bottom);
  const stageFrame = stageClock(s.game);
  const deck = surfaceZ(s.game.stageChoice, 0, stageFrame);
  const angle = (10.0 - camera.tilt) * Math.PI / 180.0;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const reach = f32(s.camera.distance * s.camera.tangent);
  const pitch = f32(s.camera.tangent * sine);
  const above = f32(reach / f32(cosine + pitch));
  const below = f32(reach / f32(cosine - pitch));
  s.camera.z = Math.min(f32(f32(deck + below) - 24.0), Math.max(f32(f32(deck - above) + 24.0), s.camera.z));
  const depth = f32(s.camera.distance - f32(f32(deck - s.camera.z) * sine));
  const width = f32(f32(depth * s.camera.tangent) * aspect);
  const left = surfaceLeft(s.game.stageChoice, 0, stageFrame);
  const right = surfaceRight(s.game.stageChoice, 0, stageFrame);
  s.camera.x = Math.min(f32(f32(right + width) - 24.0), Math.max(f32(f32(left - width) + 24.0), s.camera.x));
  s.camera.x = Math.min(WORLD_BOUNDS.right - s.origin.x, Math.max(WORLD_BOUNDS.left - s.origin.x, s.camera.x));
}

export const pauseCameraAngle = (s: Readonly<ShellState>): number => ARENA_CAMERA.angleOfAttack + (s.pauseCamera?.tilt ?? 0.0);


export function servicePauseCameraControls(s: ShellState): void {
  if (!s.session.paused || s.game.phase !== Phase.match) return;
  const controls = s.rollback?.journal?.editbox?.takePauseControls() ?? "";
  for (let index = 0; index < controls.length; index++) {
    const key = controls.charAt(index);
    const code = key === "=" ? 0xbb : key === "-" ? 0xbd : key.toUpperCase().charCodeAt(0);
    cameraKey(s, undefined, code, true);
    cameraKey(s, undefined, code, false);
  }
}
