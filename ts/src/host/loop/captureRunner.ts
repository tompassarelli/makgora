import { writeLines } from "wisp/src/platform/fileio";
import { CAPTURE_SCREEN_FILE, CAPTURE_STATUS_FILE } from "../../game/core/gameFiles";
import { emptyBounds, hurtBounds, screenBox, effectBounds, type PixelBox } from "../../game/presentation/screenBoxes";
import { fighterAt, isActive } from "../../game/sim/roster";
import { type CaptureFixture, SILHOUETTE_HIDDEN_FRAME, type Silhouette } from "../../platform/captureFixtures";
import { nativeDriverCommand } from "../../platform/nativeDriver";
import { applyDeveloperCommand } from "./developerCommands";
import { paintDrawnStamp } from "./drawnStamp";
import { bareFighter } from "./fighterCloak";
import { holdAgeSeekedEffects } from "./heldAnimations";
import { type ShellState, shellState } from "./state";
import { clearTextMessages, screenHeight, screenWidth } from "wisp/game/frames";
import { cameraEyeX, cameraEyeY, cameraEyeZ, cameraField, cameraTargetX, cameraTargetY, cameraTargetZ } from "wisp/game/view";
import { toReal } from "wisp/game/text";

const WARMUP_TICKS = 300;

const OPENING_TICKS = 120;

const HOLD_TICKS = 180;

const CUE_SETTLE_TICKS = 120;

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
const freshRunner = (ticks: number): Runner => ({ ticks, script: -1, stage: "opening", frame: 0, held: 0, tail: 0, hidden: false });
const runner = (): Runner => globalThis.__smashcraftCaptureRunner ??= freshRunner(0);

export function restartCapture(): void { globalThis.__smashcraftCaptureRunner = freshRunner(WARMUP_TICKS - 1); }

function status(line: string): void { writeLines(CAPTURE_STATUS_FILE, [line]); }

const screenLines: string[] = [];
const boxText = (box: PixelBox | undefined) => box === undefined ? "- - - -" : `${box.x} ${box.y} ${box.width} ${box.height}`;
const bares = (silhouette: Silhouette | undefined): silhouette is Silhouette => silhouette !== undefined && silhouette.conceal !== "cues";

function recordScreenBoxes(s: ShellState, fixture: CaptureFixture, slot: 0 | 1, frame: number): void {
  if (!isActive(s.world, slot)) return;
  const fighter = fighterAt(s.world, slot);
  const width = screenWidth();
  const height = screenHeight();
  const aspect = height > 0 ? toReal(width) / toReal(height) : 16.0 / 9.0;
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

function openingTick(r: Runner, fixture: CaptureFixture): void {
  if (++r.held < (fixture.openingTicks ?? OPENING_TICKS)) return;
  r.held = 0;
  r.stage = "target";
  nativeDriverCommand(`resume ${fixture.frames[0] ?? 0}`);
}

function beginHold(s: ShellState, r: Runner, fixture: CaptureFixture, target: number): void {
  const silhouette = fixture.silhouette;
  if (silhouette !== undefined && r.held === 0) {
    clearTextMessages();
    if (silhouette.conceal === "cues" && !r.hidden) recordScreenBoxes(s, fixture, silhouette.slot, target);
  }
  if (silhouette !== undefined && r.hidden && r.held === (silhouette.conceal === "cues" ? CUE_SETTLE_TICKS : 0)) {
    paintDrawnStamp(globalThis.__smashcraftDriverScripts ?? 0, target + SILHOUETTE_HIDDEN_FRAME);
    r.stampTick = r.ticks;
  }
  holdAgeSeekedEffects(s);
  r.view = [screenWidth(), screenHeight(), cameraField(CAMERA_FIELD_FIELD_OF_VIEW), cameraEyeX(), cameraEyeY(), cameraEyeZ(), cameraTargetX(), cameraTargetY(), cameraTargetZ()];
}

function hidesNext(s: ShellState, r: Runner, silhouette: Silhouette | undefined): boolean {
  if (silhouette === undefined) return false;
  r.hidden = !r.hidden;
  applyDeveloperCommand(s, 0, `-dev ${r.hidden ? "hide" : "show"} ${silhouette.conceal === "cues" ? "cues" : "fighter"} ${silhouette.slot}`);
  clearTextMessages();
  if (r.hidden) r.hideTick = r.ticks;
  return r.hidden;
}

function nextFrame(s: ShellState, r: Runner, fixture: CaptureFixture, target: number): void {
  r.frame++;
  const next = fixture.frames[r.frame];
  if (next !== undefined) {
    nativeDriverCommand(`resume ${next}`);
    return;
  }
  r.stage = "tail";
  if (bares(fixture.silhouette)) bareFighter(s, fixture.silhouette.slot, false);
  r.tail = target + (fixture.tailFrames ?? TAIL_FRAMES);
  nativeDriverCommand(`resume ${r.tail}`);
}

function targetTick(s: ShellState, r: Runner, fixture: CaptureFixture, now: number): void {
  const target = fixture.frames[r.frame];
  const silhouette = fixture.silhouette;
  if (bares(silhouette)) bareFighter(s, silhouette.slot, true);
  if (target === undefined || now !== target) return;
  beginHold(s, r, fixture, target);
  if (++r.held < (fixture.holdTicks ?? HOLD_TICKS)) return;
  r.held = 0;
  if (!hidesNext(s, r, silhouette)) nextFrame(s, r, fixture, target);
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
  } else if (r.stage === "opening") openingTick(r, fixture);
  else targetTick(s, r, fixture, now);
}
