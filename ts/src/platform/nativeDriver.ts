import { Action, bit } from "../game/input/actions";
import { sampleKeys, commitEdges, keyboardCapture, type KeyboardCapture } from "../game/input/keyboardCapture";
import { PARTICIPANT_SLOTS, isParticipantSlot } from "../game/input/participants";
import { copyInput } from "../game/input/inputRow";
import { startKeyUp } from "../game/match/controls";
import { Phase, setHumanCount } from "../game/lobby/lobbyState";
import { parseDecimal } from "../game/netcode/journal/decimal";
import { beginMomentSave, continueMomentSave, momentInput } from "../game/replay/moment";
import { writeRepro } from "wisp/src/platform/repro";
import { reproFile } from "wisp/src/runtime/repro";
import { installNativeDriver, startNativeDriver, serviceNativeDriver, publishNativeDriverStatus } from "wisp/src/platform/nativeDriver";
import { squareRootFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { max } from "../game/core/numbers";
import { DASH_STICK_THRESHOLD, STICK_DEADZONE, TAP_JUMP_STICK_THRESHOLD, TRIGGER_FULL_LEVEL, TRIGGER_PRESS_LEVEL } from "../game/sim/stickZones";
import { finishInputTrace } from "../host/loop/trace";
import { confirmedChecksum, startInputTrace } from "../host/loop/diagnostics";
import { pauseMatchPresentation } from "../host/loop/view";
import { startDown } from "../host/loop/keys";
import { applyDeveloperCommand } from "../host/loop/developerCommands";
import { shell, type ShellState, localSlot } from "../host/loop/state";
import { paintDrawnStamp } from "../host/loop/drawnStamp";
import { fighterAt, neutralControls } from "../game/sim/roster";
import { AttackStyle, DownState } from "../game/sim/codes";
import { beginHeldCamera } from "../host/loop/heldCamera";
import { beginFighterAttack } from "../game/sim/attacks";
import { startFighterSpecial } from "../game/sim/specials";
import { attackStartupFrames, isAerialAttack } from "../game/sim/moves";
import { fillMeter, spendUltimate } from "../game/sim/meter";
import type { Fighter } from "../game/sim/fighter";
import { beginAttack, beginDownState } from "../game/sim/transitions";
import { selectScriptedAttackClip } from "../game/presentation/fighterPose";
import { at } from "wisp/src/runtime/lookup";

interface Pad {
  buttons: number;
  x: number;
  z: number;
  cx: number;
  cz: number;
  shield: number;
  viewSince: number | undefined;
  viewSaved: boolean;
  readonly capture: KeyboardCapture;
}
interface Edge {
  readonly order: number;
  readonly frame: number;
  readonly slot: number;
  readonly action: string;
  readonly args: readonly string[];
}
interface Driver {
  edges: readonly Edge[];
  next: number;
  captures: number[];
  paused: boolean;
  target: number | undefined;

  frozen: boolean;
  readonly pads: readonly Pad[];
}
declare global {
  var __smashcraftNativeDriver: Driver | undefined;

  var __smashcraftDriverScripts: number | undefined;
}

const neutralPad = (): Pad => ({ buttons: 0, x: 0.0, z: 0.0, cx: 0.0, cz: 0.0, shield: 0.0, viewSince: undefined, viewSaved: false, capture: keyboardCapture() });
const state = (): Driver => globalThis.__smashcraftNativeDriver ??= { edges: [], next: 0, captures: [], paused: true, target: undefined, frozen: false, pads: PARTICIPANT_SLOTS.map(() => neutralPad()) };
const PAD_LETTERS: readonly string[] = ["a", "b", "c", "d"];
const BUTTONS: Readonly<Record<string, number>> ={ A: 1, B: 2, X: 4, Y: 8, LB: 16, TL: 16, RB: 32, TR: 32, START: 64, VIEW: 128 };
const SHOWCASE_BRACE_FRAMES = 120;
const SHOWCASE_BRACE_DAMAGE = 999.0;

function whole(text: string): number {
  const result = parseDecimal(text);
  if (result === undefined || `${result}` !== text) throw new Error(`native driver: expected a whole frame count, got ${text}`);
  return result;
}
function real(text: string | undefined, low: number, high: number): number {
  const value = text === undefined ? undefined : Number(text);
  if (value === undefined || value !== value || value < low || value > high) throw new Error("native driver: pad value outside its range");
  return f32(value);
}


function parseScript(text: string): { readonly setup: string; readonly edges: readonly Edge[] } {
  let setup = "-dev quick";
  let previous = 0;
  const edges: Edge[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("#! chat ")) { setup = line.substring(8); continue; }
    const source = line.split("#")[0]?.trim() ?? "";
    if (source === "") continue;
    const [frameText, player, action, ...args] = source.split("\t").join(" ").split(" ").filter(word => word !== "");
    const slot = player === undefined ? -1 : PAD_LETTERS.indexOf(player);
    if (frameText === undefined || action === undefined || slot < 0) throw new Error(`native driver: invalid pad line ${source}`);
    const frame = frameText.startsWith("+") ? previous + whole(frameText.substring(1)) : whole(frameText);
    if (frame < previous) throw new Error("native driver: pad frames must be ordered");
    previous = frame;
    if (action === "capture") { edges.push({ order: edges.length, frame, slot, action, args }); continue; }

    if (action === "chat" || action === "move" || action === "brace" || action === "cross" || action === "hold") { edges.push({ order: edges.length, frame, slot, action, args }); continue; }
    if (action === "press" || action === "release" || action === "tap") {
      if (BUTTONS[(args[0] ?? "").toUpperCase()] === undefined) throw new Error("native driver: unknown pad button");
      const held = action === "tap" ? args[1] === undefined ? 1 : whole(args[1]) : 0;
      if (action === "tap" && (held < 1 || held > 600)) throw new Error("native driver: tap length must be 1..600");
      edges.push({ order: edges.length, frame, slot, action: action === "tap" ? "press" : action, args });
      if (action === "tap") edges.push({ order: edges.length, frame: frame + held, slot, action: "release", args });
    } else if (action === "stick" || action === "cstick") {
      real(args[0], -1.0, 1.0); real(args[1], -1.0, 1.0);
      edges.push({ order: edges.length, frame, slot, action, args });
    } else if (action === "shield") {
      real(args[0], 0.0, 1.0);
      edges.push({ order: edges.length, frame, slot, action, args });
    } else throw new Error(`native driver: unknown pad action ${action}`);
  }
  return { setup, edges: edges.sort((a, b) => a.frame !== b.frame ? a.frame - b.frame : a.order - b.order) };
}

function stick(x: number, z: number): readonly [number, number] {
  const radius = squareRootFloat32(f32(f32(x * x) + f32(z * z)));
  if (radius > 1.0) { x = f32(x / radius); z = f32(z / radius); }
  return [Math.abs(x) <= STICK_DEADZONE ? 0.0 : x, Math.abs(z) <= STICK_DEADZONE ? 0.0 : z];
}
function padSample(pad: Pad): void {
  const [x = 0.0, z = 0.0] = stick(pad.x, pad.z);
  const [cx = 0.0, cz = 0.0] = stick(pad.cx, pad.cz);
  let held = 0;
  const set = (action: Action, active: boolean) => { if (active) held |= bit(action); };
  set(Action.attack, (pad.buttons & 1) !== 0);
  set(Action.jump, (pad.buttons & 10) !== 0);
  set(Action.special, (pad.buttons & 4) !== 0);
  set(Action.strong, (pad.buttons & 16) !== 0);
  set(Action.grab, (pad.buttons & 32) !== 0);
  set(Action.leftTrigger, pad.shield > f32(TRIGGER_PRESS_LEVEL / TRIGGER_FULL_LEVEL));
  set(Action.moveLeft, x < 0.0); set(Action.moveRight, x > 0.0);
  set(Action.moveDown, z <= -TAP_JUMP_STICK_THRESHOLD); set(Action.moveUp, z > 0.0);
  set(Action.cLeft, cx <= -DASH_STICK_THRESHOLD); set(Action.cRight, cx >= DASH_STICK_THRESHOLD);
  set(Action.cDown, cz <= -TAP_JUMP_STICK_THRESHOLD); set(Action.cUp, cz >= TAP_JUMP_STICK_THRESHOLD);
  sampleNativeKeys(pad.capture, held, x, z);
}

export function sampleNativeKeys(capture: KeyboardCapture, held: number, x: number, z: number): void {
  const row = capture.row;
  const special = (held & bit(Action.special)) !== 0 && (row.held & bit(Action.special)) === 0 && (row.pressed & bit(Action.special)) === 0;
  const dodge = (held & bit(Action.leftTrigger)) !== 0 && (row.held & bit(Action.leftTrigger)) === 0;
  sampleKeys(capture, held);
  const direction = (value: number) => value > 0.0 ? 1 : value < 0.0 ? -1 : 0;
  if (special) { row.specialX = direction(x); row.specialZ = direction(z); }
  if (dodge) { row.dodgeX = direction(x); row.dodgeZ = direction(z); }
  row.axisX = Math.trunc(f32(x * 127.0));
  row.axisZ = Math.trunc(f32(z * 127.0));
}
function applyEdge(s: ShellState, pad: Pad, edge: Edge): void {
  const button = BUTTONS[(edge.args[0] ?? "").toUpperCase()] ?? 0;
  if ((edge.action === "press" || edge.action === "release") && button === 64 && isParticipantSlot(edge.slot)) {
    if (edge.action === "press") startDown(s, edge.slot);
    else startKeyUp(s.session, edge.slot);
  }
  if (button === 128 && edge.action === "press" && (pad.buttons & button) === 0) { pad.viewSince = edge.frame; pad.viewSaved = false; }
  if (button === 128 && edge.action === "release") { pad.viewSince = undefined; pad.viewSaved = false; }
  if (edge.action === "press") pad.buttons |= button;
  else if (edge.action === "release") pad.buttons &= ~button;
  else if (edge.action === "stick") { pad.x = real(edge.args[0], -1.0, 1.0); pad.z = real(edge.args[1], -1.0, 1.0); }
  else if (edge.action === "cstick") { pad.cx = real(edge.args[0], -1.0, 1.0); pad.cz = real(edge.args[1], -1.0, 1.0); }
  else pad.shield = real(edge.args[0], 0.0, 1.0);
  padSample(pad);
}
function saveFrame(s: ShellState): void {
  if (s.runtime.simulationFrame === 0) return;
  if (!beginMomentSave(s.moment.recorder, momentInput(s.build), s.world, s.game, s.controls, s.runtime)) throw new Error("native driver: could not save held frame");
  let saved = continueMomentSave(s.moment.recorder, s.diagnostic);
  while (saved === undefined) saved = continueMomentSave(s.moment.recorder, s.diagnostic);
  writeRepro(reproFile(localSlot(), saved.frame, ++s.moment.saved, "smashcraft"), { build: s.build.id, frame: saved.frame, checksum: saved.checksum }, saved.lines);
}
function publish(s: ShellState): void {
  publishNativeDriverStatus(s.runtime.simulationFrame, confirmedChecksum(s), state().paused);
  paintDrawnStamp(globalThis.__smashcraftDriverScripts ?? 0, s.runtime.simulationFrame);
}


function freeze(s: ShellState, driver: Driver, frozen: boolean): void {
  if (driver.frozen === frozen || s.game.phase !== Phase.match) return;
  driver.frozen = frozen;
  pauseMatchPresentation(s, frozen || s.session.paused);
}


function resume(s: ShellState, driver: Driver, command: string): void {
  if (s.session.paused) { s.session.paused = false; pauseMatchPresentation(s, false); }
  freeze(s, driver, false);
  const stepping = command.startsWith("step ");
  const count = command === "resume" ? undefined : whole(command.substring(command.indexOf(" ") + 1));
  driver.target = count === undefined ? undefined : stepping ? s.runtime.simulationFrame + count : count;
  if (driver.target !== undefined && driver.target < s.runtime.simulationFrame) throw new Error("native driver: target frame is behind this match");
  driver.paused = driver.target === s.runtime.simulationFrame;
  publish(s);
}

function runDevVerb(s: ShellState, command: string): boolean {
  if (!command.startsWith("dev ")) return false;
  if (s.build.inputProfile === "native-driver") {
    applyDeveloperCommand(s, 0, command.substring(4).trim());
    publish(s);
  }
  return true;
}

export function nativeDriverCommand(text: string): void {
  const s = shell();
  const driver = state();
  const command = text.trim();
  if (command === "reset") {
    applyDeveloperCommand(s, 0, "-dev reset");
    globalThis.__smashcraftNativeDriver = { edges: [], next: 0, captures: [], paused: true, target: undefined, frozen: false, pads: PARTICIPANT_SLOTS.map(() => neutralPad()) };
    publish(s);
    return;
  }
  if (command === "capture") { driver.paused = true; driver.target = undefined; saveFrame(s); finishInputTrace(s.trace); publish(s); return; }
  if (command === "pause") { driver.paused = true; driver.target = undefined; publish(s); return; }
  if (command === "resume" || command.startsWith("resume ") || command.startsWith("step ")) { resume(s, driver, command); return; }
  if (runDevVerb(s, command)) return;
  const script = parseScript(text);
  applyDeveloperCommand(s, 0, "-dev reset");

  setHumanCount(s.game, 2);
  applyDeveloperCommand(s, 0, script.setup);
  globalThis.__smashcraftDriverScripts = (globalThis.__smashcraftDriverScripts ?? 0) + 1;
  if (s.game.phase !== Phase.match || s.runtime.simulationFrame !== 0) throw new Error("native driver: pad setup did not start a new match");
  globalThis.__smashcraftNativeDriver = { edges: script.edges, next: 0, captures: [], paused: true, target: undefined, frozen: false, pads: PARTICIPANT_SLOTS.map(() => neutralPad()) };
  startInputTrace(s);
  publish(s);
}


function chargeScriptedMeter(fighter: Fighter, kind: string): void {
  fillMeter(fighter);
  if (kind !== "ultimate") spendUltimate(fighter);
}

function liftTarget(target: Fighter, z: number): void {
  target.motion.grounded = false;
  target.motion.z = max(0.0, z);
  target.motion.vz = 0.0;
}

function hangTarget(target: Fighter, z: number, frames: number): void {
  const gravity = target.tuning.physics.gravity;
  target.motion.grounded = false;
  target.motion.z = max(0.0, f32(z - f32(gravity * f32(frames * (frames - 1) * 0.5))));
  target.motion.vz = f32(gravity * frames);
}

export function startScriptedMove(s: ShellState, slot: number, kind: string | undefined, code: string, facing: string | undefined): void {
  if (s.build.inputProfile !== "native-driver") return;
  const fighter = fighterAt(s.world, slot);
  const frame = s.runtime.simulationFrame + 1;
  fighter.facing = facing === "left" ? -1 : 1;
  if (kind === "normal") {
    const style = Object.values(AttackStyle).find(value => value === whole(code));
    if (style === undefined) throw new Error("native driver: invalid move style");
    if (isAerialAttack(style)) { fighter.motion.grounded = false; fighter.motion.z = 250.0; }
    if (style === AttackStyle.getupAttack) beginDownState(fighter, DownState.attack, 0);
    else if (style === AttackStyle.ledgeAttack) beginAttack(fighter, style, false);
    else beginFighterAttack(s.world, slot, style, false);
    if (fighter.attack.style !== style) throw new Error("native driver: normal did not start");
    selectScriptedAttackClip(at(s.runtime.poses, slot), fighter);
  } else if (kind === "special" || kind === "ultimate") {
    const input = neutralControls();
    input.specialPressed = true;
    input.ultimatePressed = kind === "ultimate";
    const direction = whole(code);
    input.specialX = direction === 1 ? fighter.facing : 0;
    input.specialZ = direction === 2 ? 1 : direction === 3 ? -1 : 0;
    chargeScriptedMeter(fighter, kind);
    if (!startFighterSpecial(fighter, s.game.stageChoice, frame, input, s.world)) throw new Error("native driver: move did not start");
  } else throw new Error("native driver: move needs normal, special, ultimate, hop or run");
}

export function beforeNativeDriverTick(s: ShellState): boolean {
  if (s.build.inputProfile !== "native-driver") return true;
  serviceNativeDriver();
  const driver = state();
  return !driver.paused;
}


function braceTarget(target: Fighter): void {
  target.status.armorFrames = SHOWCASE_BRACE_FRAMES;
  target.status.armorMaxDamage = SHOWCASE_BRACE_DAMAGE;
  target.status.armorKnockback = 0.0;
}

function crossTarget(target: Fighter, args: readonly string[]): void {
  const [facing, gap = "0"] = args;
  target.motion.x = (facing === "left" ? -1 : 1) * S2R(gap);
  target.motion.vx = 0.0;
  for (const entry of target.hits.entries) entry.window = 0;
}

function stageScriptedMove(s: ShellState, slot: number, args: readonly string[]): void {
  const [kind, code = "", facing, gap = "500", lift] = args;
  const mover = fighterAt(s.world, slot), target = fighterAt(s.world, slot === 0 ? 1 : 0);
  if (kind === "hop" || kind === "run") {
    const direction = facing === "left" ? -1 : 1;
    mover.facing = direction;
    if (kind === "run") {
      mover.motion.x = -direction * S2R("60");
      target.motion.x = direction * S2R("260");
    }
    return;
  }
  if (gap !== "-") {
    mover.motion.x = 0.0;
    target.motion.x = (facing === "left" ? -1 : 1) * S2R(gap);
  }
  startScriptedMove(s, slot, kind, code, facing);
  if (lift !== undefined && mover.motion.grounded) hangTarget(target, S2R(lift), mover.attack.style === undefined ? 0 : attackStartupFrames(mover.attack.style, mover.tuning.moves));
  else if (lift !== undefined) liftTarget(target, f32(mover.motion.z + S2R(lift)));
}

function applyShowcaseEdge(s: ShellState, edge: Edge): boolean {
  const target = fighterAt(s.world, edge.slot === 0 ? 1 : 0);
  if (edge.action === "move") stageScriptedMove(s, edge.slot, edge.args);
  else if (edge.action === "brace") braceTarget(target);
  else if (edge.action === "cross") crossTarget(target, edge.args);
  else if (edge.action === "hold") beginHeldCamera(s, edge.frame + whole(edge.args[0] ?? "0"));
  else return false;
  return true;
}

export function captureNativeDriverInputs(s: ShellState): void {
  if (s.build.inputProfile !== "native-driver") return;
  const driver = state();
  const frame = s.runtime.simulationFrame + 1;
  while (driver.next < driver.edges.length) {
    const edge = driver.edges[driver.next];
    if (edge === undefined || edge.frame > frame) break;
    const pad = driver.pads[edge.slot];
    if (edge.action === "capture") driver.captures.push(edge.slot);
    else if (edge.action === "chat") applyDeveloperCommand(s, edge.slot, edge.args.join(" "));
    else if (!applyShowcaseEdge(s, edge) && pad !== undefined) applyEdge(s, pad, edge);
    driver.next++;
  }
  for (const slot of PARTICIPANT_SLOTS) {
    const pad = driver.pads[slot];
    if (pad === undefined) continue;
    padSample(pad);
    copyInput(s.participants[slot].capture.row, pad.capture.row);
    commitEdges(pad.capture);
  }
}

export function afterNativeDriverTick(s: ShellState): void {
  if (s.build.inputProfile !== "native-driver") return;
  const driver = state();
  for (const slot of PARTICIPANT_SLOTS) {
    const pad = driver.pads[slot];
    if (pad !== undefined && pad.viewSince !== undefined && !pad.viewSaved && s.runtime.simulationFrame - pad.viewSince >= 60) {
      pad.viewSaved = true;
      driver.captures.push(slot);
    }
  }
  if (driver.captures.includes(localSlot())) saveFrame(s);
  driver.captures = [];
  if (driver.target !== undefined && s.runtime.simulationFrame >= driver.target || s.game.phase !== Phase.match || s.session.paused) {
    driver.paused = true;
    driver.target = undefined;
    freeze(s, driver, true);
    saveFrame(s);
    publish(s);
  } else paintDrawnStamp(globalThis.__smashcraftDriverScripts ?? 0, s.runtime.simulationFrame);
}
export function installSmashcraftNativeDriver(): void { installNativeDriver(nativeDriverCommand); }
export function startSmashcraftNativeDriver(players: readonly number[] = [0, 1]): void { state(); startNativeDriver(players); }
