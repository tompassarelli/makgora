




import type { MapBuild } from "../game/shell/build";
import { NATIVE_DRIVER_BUILD } from "../game/shell/currentBuild";
import { install as installGame, startBuild } from "./main";
import { nativeDriverCommand } from "./nativeDriver";
import { shellState } from "./shell/state";
import { on, trampoline } from "wisp/src/platform/dispatch";
import { writeLines } from "wisp/src/platform/fileio";
import { f32 } from "wisp/src/sim/f32";
import { CAPTURE_FIXTURES, type CaptureFixture, SILHOUETTE_HIDDEN_FRAME } from "./captureFixtures";
import { applyDeveloperCommand } from "./shell/keys";
import { bareFighter } from "./shell/fighterCloak";
import { paintDrawnStamp } from "./shell/drawnStamp";
import { CAPTURE_SCREEN_FILE, CAPTURE_STATUS_FILE } from "../runtime/gameFiles";
import { emptyBounds, hurtBounds, screenBox, effectBounds, type PixelBox } from "../game/presentation/screenBoxes";
import { fighterAt, isActive } from "../game/sim/roster";
import type { ShellState } from "./shell/state";

const BUILD: MapBuild = { ...NATIVE_DRIVER_BUILD, presentation: "pool-predicted" };
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

const screenLines: string[] = [];
const boxText = (box: PixelBox | undefined) => box === undefined ? "- - - -" : `${box.x} ${box.y} ${box.width} ${box.height}`;

function recordScreenBoxes(s: ShellState, fixture: CaptureFixture, slot: 0 | 1, frame: number): void {
  if (!isActive(s.world, slot)) return;
  const fighter = fighterAt(s.world, slot);
  const width = BlzGetLocalClientWidth();
  const height = BlzGetLocalClientHeight();
  const aspect = height > 0 ? I2R(width) / I2R(height) : 16.0 / 9.0;
  const region = screenBox(s.camera, aspect, width, height, effectBounds(fighter, hurtBounds(fighter, emptyBounds())));
  const body = screenBox(s.camera, aspect, width, height, hurtBounds(fighter, emptyBounds()));
  screenLines.push(`SCREEN ${fixture.name} ${frame} ${width} ${height} ${boxText(region)} ${boxText(body)}`);
  writeLines(CAPTURE_SCREEN_FILE, screenLines);
}

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
  const cues = silhouette?.conceal === "cues";
  if (silhouette !== undefined && !cues) bareFighter(s, silhouette.slot, true);
  if (target === undefined || now !== target) return;
  if (silhouette !== undefined && r.held === 0) {
    ClearTextMessages();
    if (cues && !r.hidden) recordScreenBoxes(s, fixture, silhouette.slot, target);
  }
  if (silhouette !== undefined && r.hidden && r.held === (cues ? 120 : 0)) {
    paintDrawnStamp(globalThis.__smashcraftDriverScripts ?? 0, target + SILHOUETTE_HIDDEN_FRAME);
    r.stampTick = r.ticks;
  }
  r.view = [BlzGetLocalClientWidth(), BlzGetLocalClientHeight(), GetCameraField(CAMERA_FIELD_FIELD_OF_VIEW), GetCameraEyePositionX(), GetCameraEyePositionY(), GetCameraEyePositionZ(), GetCameraTargetPositionX(), GetCameraTargetPositionY(), GetCameraTargetPositionZ()];
  if (++r.held < (fixture.holdTicks ?? HOLD_TICKS)) return;
  r.held = 0;
  if (silhouette !== undefined) {
    r.hidden = !r.hidden;
    applyDeveloperCommand(s, 0, `-dev ${r.hidden ? "hide" : "show"} ${cues ? "cues" : "fighter"} ${silhouette.slot}`);
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
  if (silhouette !== undefined && !cues) bareFighter(s, silhouette.slot, false);
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
