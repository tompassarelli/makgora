




import type { MapBuild } from "../../game/session/build";
import { NATIVE_DRIVER_BUILD } from "../../game/session/currentBuild";
import { install as installGame, startBuild } from "../../platform/main";
import { nativeDriverCommand } from "../../platform/nativeDriver";
import { shellState } from "../loop/state";
import { on, trampoline } from "wisp/src/platform/dispatch";
import { writeLines } from "wisp/src/platform/fileio";
import { f32 } from "wisp/src/sim/f32";
import { CAPTURE_FIXTURES, type CaptureFixture, SILHOUETTE_HIDDEN_FRAME } from "../../platform/captureFixtures";
import { applyDeveloperCommand } from "../loop/developerCommands";
import { bareFighter } from "../loop/fighterCloak";
import { paintDrawnStamp } from "../loop/drawnStamp";
import { holdAgeSeekedEffects } from "../loop/heldAnimations";
import { CAPTURE_STATUS_FILE } from "../../game/core/gameFiles";

const BUILD: MapBuild = { ...NATIVE_DRIVER_BUILD, presentation: "pool-predicted", receiptsOnScreen: false, disjointCues: false };
const TICK = "capture.fixtures";

const WARMUP_TICKS = 300;

const OPENING_TICKS = 120;

const HOLD_TICKS = 180;

const TAIL_FRAMES = 30;

interface Runner {
  ticks: number;
  script: number;

  stage: "opening" | "target" | "tail";
  frame: number;
  held: number;
  tail: number;

  hidden: boolean;
  hideTick?: number;
  stampTick?: number;
  view?: number[];
}
declare global { var __smashcraftCaptureRunner: Runner | undefined; }
const runner = (): Runner => globalThis.__smashcraftCaptureRunner ??= { ticks: 0, script: -1, stage: "opening", frame: 0, held: 0, tail: 0, hidden: false };

function status(line: string): void { writeLines(CAPTURE_STATUS_FILE, [line]); }

function nextScript(r: Runner, fixtures: readonly CaptureFixture[]): void {
  r.script++;
  r.stage = "opening";
  r.frame = 0;
  r.held = 0;
  const fixture = fixtures[r.script];
  if (fixture === undefined) {
    nativeDriverCommand("reset");
    status(`CAPTURE DONE ${fixtures.length}`);
    return;
  }
  nativeDriverCommand(fixture.script);
  status(`CAPTURE SCRIPT ${r.script + 1} ${fixture.name}`);
}

export function captureTick(fixtures: readonly CaptureFixture[]): void {
  const s = shellState();
  const r = runner();
  if (s === undefined || ++r.ticks < WARMUP_TICKS) return;
  if (r.script < 0) { nextScript(r, fixtures); return; }
  const fixture = fixtures[r.script];
  if (fixture === undefined) return;
  const now = s.runtime.simulationFrame;
  if (r.stage === "tail") {
    if (now >= r.tail) nextScript(r, fixtures);
    return;
  }
  if (r.stage === "opening") {
    if (++r.held < (fixture.openingTicks ?? OPENING_TICKS)) return;
    r.held = 0;
    r.stage = "target";
    nativeDriverCommand(`resume ${fixture.frames[0] ?? 0}`);
    return;
  }
  const target = fixture.frames[r.frame];
  const silhouette = fixture.silhouette;
  if (silhouette !== undefined) bareFighter(s, silhouette.slot, true);
  if (target === undefined || now !== target) return;
  if (silhouette !== undefined && r.held === 0) {
    ClearTextMessages();
    if (r.hidden) {
      paintDrawnStamp(globalThis.__smashcraftDriverScripts ?? 0, target + SILHOUETTE_HIDDEN_FRAME);
      r.stampTick = r.ticks;
    }
  }
  holdAgeSeekedEffects(s);
  r.view = [BlzGetLocalClientWidth(), BlzGetLocalClientHeight(), GetCameraField(CAMERA_FIELD_FIELD_OF_VIEW), GetCameraEyePositionX(), GetCameraEyePositionY(), GetCameraEyePositionZ(), GetCameraTargetPositionX(), GetCameraTargetPositionY(), GetCameraTargetPositionZ()];
  if (++r.held < (fixture.holdTicks ?? HOLD_TICKS)) return;
  r.held = 0;
  if (silhouette !== undefined) {
    r.hidden = !r.hidden;
    applyDeveloperCommand(s, 0, `-dev ${r.hidden ? "hide" : "show"} fighter ${silhouette.slot}`);
    ClearTextMessages();
    if (r.hidden) {
      r.hideTick = r.ticks;
      return;
    }
  }
  r.frame++;
  const next = fixture.frames[r.frame];
  if (next !== undefined) {
    nativeDriverCommand(`resume ${next}`);
    return;
  }
  r.stage = "tail";
  if (silhouette !== undefined) bareFighter(s, silhouette.slot, false);
  r.tail = target + (fixture.tailFrames ?? TAIL_FRAMES);
  nativeDriverCommand(`resume ${r.tail}`);
}

function tick(): void {
  captureTick(CAPTURE_FIXTURES);
}

export function install(this: void): void {
  installGame(BUILD);
  on(TICK, tick);
}

export function start(this: void): void {
  startBuild(BUILD);
  on(TICK, tick);
  TimerStart(CreateTimer(), f32(0.01666666753590107), true, trampoline(TICK));
}
