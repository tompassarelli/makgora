import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../match/inputAdapter";
import { inputRow, type InputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { createReplaySnapshot } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { setWorldMotionValue } from "../sim/motion";
import { fighterAt } from "../sim/roster";
import { WARDEN_SPECIALS } from "../sim/heroes/wardenSpecials";
import { CueLinger, type CuePlace } from "./cueLinger";
import { advanceFighterPose, createFighterPose } from "./fighterPose";
import { CUE_ANCHORS, HERO_CUES, specialCueState } from "./specialCues";

const AIR_HEIGHT = 300.0;
const WATCH_TICKS = 40;
const BURST = HERO_CUES[Character.warden]?.down.active;

function row(press: "fan" | "jump" | "none"): InputRow {
  const built = inputRow(press === "fan" ? { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 }
    : press === "jump" ? { held: maskOf(Action.jump), pressed: maskOf(Action.jump) } : {});
  if (built === undefined) throw new Error(`${press} input row`);
  return built;
}

interface Shown { readonly tick: number; readonly place: CuePlace; readonly lingering: boolean }

/** Plays one Fan of Knives, jumping once her special frame reaches `jumpFrame` (or never), and records where its knife burst shows. */
function fanOfKnives(airborne: boolean, jumpFrame: number | undefined) {
  const state = createReplaySnapshot();
  const maiev = fighterAt(state.world, 0);
  copyFighterState(maiev, createFighter(Character.warden, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, 600.0, -1), 3);
  if (airborne) {
    maiev.motion.z = AIR_HEIGHT;
    maiev.motion.vz = 0.0;
    maiev.motion.grounded = false;
    maiev.motion.surface = undefined;
    setWorldMotionValue(maiev.motion.meleeZ, maiev.motion.z);
    setWorldMotionValue(maiev.motion.meleeVelocityZ, maiev.motion.vz);
  }
  state.match.phase = Phase.match;
  state.match.matchSeed = 551;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const pose = createFighterPose();
  const linger = new CueLinger();
  const shown: Shown[] = [];
  let cancelTick: number | undefined;
  let lastFrame = 0;
  let jumped = false;
  for (let tick = 1; tick <= WATCH_TICKS; tick++) {
    const jump: boolean = !jumped && jumpFrame !== undefined && lastFrame >= jumpFrame;
    jumped ||= jump;
    adaptInput(row(tick === 1 ? "fan" : jump ? "jump" : "none"), maiev, tick, state.controls.inputs[0], state.controls.commands[0]);
    const jumpSerial = maiev.jump.serial;
    stepMatch(state.match, state.world, state.controls, tick);
    advanceFighterPose(pose, maiev, state.world, state.controls.inputs[0], false, maiev.jump.serial !== jumpSerial, false, false);
    if (jump) {
      assertEquals(maiev.special.action, SpecialAction.none, `${airborne ? "air" : "ground"}: the jump on tick ${tick} cancels Fan of Knives`);
      assertEquals(pose.animation.startsWith("jump"), true, `${airborne ? "air" : "ground"}: her body goes into the jump on the cancel tick, not ${pose.animation}`);
      cancelTick = tick;
    }
    if (cancelTick !== undefined && maiev.special.action === SpecialAction.none) assertEquals(!pose.animation.startsWith("special"), true, `tick ${tick}: her body stays out of the special`);
    lastFrame = maiev.special.action === SpecialAction.heroDown ? maiev.special.frame : 0;
    const cueState = specialCueState(maiev);
    const cue = cueState.cues === undefined || cueState.phase === "none" ? undefined : cueState.phase === "startup" ? cueState.cues.startup : cueState.cues.active;
    const anchor = cue === undefined ? undefined : CUE_ANCHORS[cue.anchor];
    const at = anchor === undefined ? undefined : { x: maiev.motion.x + maiev.facing * anchor.x, y: 0.0, z: maiev.motion.z + anchor.z, facing: maiev.facing, scale: 1.0 };
    linger.show(cue, at, tick / 60.0, maiev.status.out);
    if (cue === BURST && at !== undefined) shown.push({ tick, place: at, lingering: false });
    else if (linger.lingering === BURST) shown.push({ tick, place: { ...linger.place }, lingering: true });
  }
  return { shown, cancelTick, lastFrame };
}

test("Maiev's Fan of Knives knife burst, ground and air, plays its full length where and facing as it was cast when she jump-cancels it on frame 4, while her body goes into the jump; uncancelled it shows as before [k1 scenario]", () => {
  const cancelFrame = WARDEN_SPECIALS.down.ground.jumpCancelFrame ?? 0;
  assertEquals(cancelFrame, WARDEN_SPECIALS.down.air?.jumpCancelFrame, "both forms jump-cancel on the same frame");
  for (const airborne of [false, true]) {
    const name = airborne ? "air" : "ground";
    const full = fanOfKnives(airborne, undefined);
    assertEquals(full.shown.length > 0, true, `${name}: an uncancelled cast shows its knife burst`);
    for (const shown of full.shown) assertEquals(!shown.lingering, true, `${name}: uncancelled, tick ${shown.tick} shows the live burst, never a lingering one`);
    const first = full.shown[0]?.tick ?? 0;
    assertEquals(full.shown.length, (full.shown[full.shown.length - 1]?.tick ?? 0) - first + 1, `${name}: the uncancelled burst shows on consecutive ticks`);

    const cancelled = fanOfKnives(airborne, cancelFrame);
    const cancelTick = cancelled.cancelTick ?? 0;
    assertEquals(cancelTick > 0, true, `${name}: she jump-cancels`);
    assertEquals(cancelled.shown.map(({ tick }) => tick).join(","), full.shown.map(({ tick }) => tick).join(","), `${name}: the cancelled burst shows on the same ticks as the full one`);
    const cast = cancelled.shown.filter(({ tick }) => tick < cancelTick);
    const castPlace = cast[cast.length - 1]?.place;
    assertEquals(castPlace !== undefined, true, `${name}: the burst shows before the cancel`);
    assertEquals(castPlace?.x, full.shown[0]?.place.x, `${name}: the cast stands where the uncancelled one starts`);
    for (const shown of cancelled.shown.filter(({ tick }) => tick >= cancelTick)) {
      assertEquals(shown.lingering, true, `${name}: tick ${shown.tick} after the cancel shows the lingering burst`);
      assertEquals(`${shown.place.x} ${shown.place.z} ${shown.place.facing}`, `${castPlace?.x} ${castPlace?.z} ${castPlace?.facing}`, `${name}: tick ${shown.tick} keeps the burst at its cast position and facing`);
    }
  }
});
