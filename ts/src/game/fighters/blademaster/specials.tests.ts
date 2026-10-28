import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { airborne, fighter, frame, scene } from "../../match/padScene";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { SELECTABLE_CHARACTERS, fighterName } from "../../roster/kits";
import { AttackStyle, Character, SpecialAction } from "../../sim/codes";
import { canAttack } from "../../sim/conditions";
import { type Fighter, createFighter, placedObject } from "../../sim/fighter";
import { attackLandingLag } from "../../sim/moves";
import { fighterAt } from "../../sim/roster";
import { mainDeckZ } from "../../sim/stage";
import { length } from "./moves";
import { BLADEMASTER_SPECIALS, IMAGE_STARTUP, MIRROR_IMAGE_OBJECT, RISE_STARTUP, WIND_WALK_END, WIND_WALK_FREEZE, WIND_WALK_GUARD, WIND_WALK_STEP_FRAME } from "./specials";
import { FOLLOW_UP_FORM } from "../../sim/specials/schema";
import { canonicalState } from "../../replay/canonical";
import { at } from "wisp/src/runtime/lookup";
import { fillMeter } from "../../sim/meter";

const BLADEMASTER_X = -200.0;
const FOE_X = 550.0;
const IMAGE_LIFE_FRAMES = 210;
const UP_SPECIAL_HOP = 120.0;
const UP_SPECIAL_WATCH = 250;

const WIND_WALK_START = f32(-length(f32(1.1)));
const COUNTER_GAP = 110.0;
const COUNTER_HEIGHT = 400.0;
const COUNTER_WATCH = 80;
const LATE_AIR_PRESS = 18;
const PUNISH_PRESS = WIND_WALK_GUARD.last + 1;
const PUNISH_RUN = 2;
const WIND_WALK_WATCH = 120;
const AIR_WHIFF_DRIFT = length(f32(0.1));
const AIR_WHIFF_HEIGHT = 1200.0;

type Punish = (self: Fighter, blademaster: Fighter, frame: number) => readonly Action[];
const toward = (self: Fighter, other: Fighter): Action => (other.motion.x >= self.motion.x ? Action.moveRight : Action.moveLeft);
const runInto = (press: Action): Punish => (self, other, frame) =>
  frame < PUNISH_RUN ? [toward(self, other)] : frame === PUNISH_RUN ? [toward(self, other), press] : [];
const DASH_ATTACK = runInto(Action.attack);
const RUNNING_GRAB = runInto(Action.grab);

function windWalkWhiffPunished(character: Character, punish: Punish): boolean {
  const s = scene(0, [{ character: Character.blademaster, x: WIND_WALK_START, facing: 1 }, { character, x: 0.0, facing: -1 }]);
  const blademaster = fighter(s, 0);
  const foe = fighter(s, 1);
  fillMeter(blademaster);
  for (let n = 1; n <= WIND_WALK_WATCH; n++) {
    frame(s, n === 1 ? [Action.moveRight, Action.special] : [], n >= PUNISH_PRESS ? punish(foe, blademaster, n - PUNISH_PRESS) : []);
    if (n === 1 && blademaster.special.action !== SpecialAction.heroSide) return false;
    if (blademaster.special.form >= FOLLOW_UP_FORM) return false;
    if (blademaster.status.damage > 0.0 || blademaster.grab.owner !== undefined) return true;
    if (n > 1 && blademaster.special.action === SpecialAction.none && canAttack(blademaster)) return false;
  }
  return false;
}

test("Blademaster's grounded Wind Walk whiff is punished by every fighter's dash attack or running grab pressed after the parry window closes [k3 measure #523]", () => {
  const misses: string[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    if (!windWalkWhiffPunished(character, DASH_ATTACK) && !windWalkWhiffPunished(character, RUNNING_GRAB)) misses.push(fighterName(character));
  }
  assertEquals(misses.join("; "), "", "Wind Walk whiffs nobody punishes");
});

interface Counter {
  readonly guardFrame: number;
  readonly frozen: number;
  readonly foeX: number;
  readonly foeZ: number;
  readonly stepX: number;
  readonly stepZ: number;
  readonly stepFacing: number;
  readonly stepGrounded: boolean;
  readonly kickDamage: number;
  readonly launchX: number;
  readonly launchZ: number;
  readonly struck: boolean;
}

function counter(press: number, foeFacing: number, air: boolean, ex = false, start = 1): Counter {
  const blademasterX = foeFacing < 0 ? 0.0 : COUNTER_GAP;
  const foeX = foeFacing < 0 ? COUNTER_GAP : 0.0;
  const s = scene(0, [{ character: Character.blademaster, x: blademasterX, facing: -foeFacing }, { character: Character.rifleman, x: foeX, facing: foeFacing }]);
  const blademaster = fighter(s, 0);
  const foe = fighter(s, 1);
  fillMeter(blademaster);
  if (air) {
    airborne(blademaster, blademasterX, f32(mainDeckZ(0) + COUNTER_HEIGHT));
    airborne(foe, foeX, f32(mainDeckZ(0) + COUNTER_HEIGHT));
  }
  const side = foeFacing < 0 ? Action.moveRight : Action.moveLeft;
  let guardFrame = 0;
  let frozen = 0;
  let parryFrame = 0;
  let step = { x: 0.0, z: 0.0, facing: 0, grounded: false, foeX: 0.0, foeZ: 0.0 };
  let before = 0.0;
  let kickDamage = 0.0;
  let struck = false;
  let launchX = 0.0;
  let launchZ = 0.0;
  for (let n = 1; n <= COUNTER_WATCH; n++) {
    const own = n === start ? [side, Action.special, ...(ex ? [Action.strong] : [])] : [];
    frame(s, own, n === press ? [Action.attack] : []);
    struck ||= blademaster.status.damage > 0.0;
    if (guardFrame === 0 && blademaster.special.form >= FOLLOW_UP_FORM) {
      guardFrame = parryFrame + 1;
      before = foe.status.damage;
    }
    if (guardFrame !== 0 && launchZ === 0.0 && foe.launch.hitlag > 0 && foe.status.damage === before) frozen++;
    if (blademaster.special.form < FOLLOW_UP_FORM) parryFrame = blademaster.special.frame;
    if (guardFrame !== 0 && blademaster.special.frame === WIND_WALK_STEP_FRAME && blademaster.special.form >= FOLLOW_UP_FORM) {
      step = { x: blademaster.motion.x, z: blademaster.motion.z, facing: blademaster.facing, grounded: blademaster.motion.grounded, foeX: foe.motion.x, foeZ: foe.motion.z };
    }
    if (guardFrame !== 0 && launchZ === 0.0 && foe.status.damage > before) {
      launchX = foe.launch.knockbackX;
      launchZ = foe.launch.knockbackZ;
      kickDamage = f32(foe.status.damage - before);
    }
  }
  return { guardFrame, frozen, foeX: step.foeX, foeZ: step.foeZ, stepX: step.x, stepZ: step.z, stepFacing: step.facing, stepGrounded: step.grounded, kickDamage, launchX, launchZ, struck };
}

function counterWindow(ex: boolean): string {
  let first = 0;
  let last = 0;
  for (let start = 1; start <= 50; start++) {
    const run = counter(50, -1, false, ex, start);
    if (run.guardFrame === 0) continue;
    first = first === 0 ? run.guardFrame : Math.min(first, run.guardFrame);
    last = Math.max(last, run.guardFrame);
  }
  return `${first}-${last}`;
}

test("Blademaster's Wind Walk counters a strike that lands on frames 5-29, EX or not [k4 reference melee]", () => {
  assertEquals(counterWindow(false), `${WIND_WALK_GUARD.first}-${WIND_WALK_GUARD.last}`, "counter window");
  assertEquals(counterWindow(true), `${WIND_WALK_GUARD.first}-${WIND_WALK_GUARD.last}`, "EX counter window");
  assertEquals(BLADEMASTER_SPECIALS.side.ground.endFrame, WIND_WALK_END, "whiff total");
});

test("A countered strike freezes the attacker 11 frames, then Blademaster stands behind them facing their back and kicks them straight up, both facings, grounded and in the air [k4 reference melee]", () => {
  const misses: string[] = [];
  for (const air of [false, true]) {
    for (const foeFacing of [-1, 1]) {
      const label = `${air ? "aerial" : "grounded"}, attacker facing ${foeFacing}`;
      let run: Counter | undefined;
      for (let press = air ? LATE_AIR_PRESS : 6; press <= 24 && run === undefined; press++) {
        const each = counter(press, foeFacing, air);
        if (each.guardFrame !== 0) run = each;
      }
      if (run === undefined) {
        misses.push(`${label}: never countered`);
        continue;
      }
      if (run.struck) misses.push(`${label}: struck`);
      if (run.frozen !== WIND_WALK_FREEZE) misses.push(`${label}: frozen ${run.frozen}`);
      const behind = f32(f32(run.stepX - run.foeX) * -foeFacing);
      if (behind <= 0.0) misses.push(`${label}: not behind (${behind})`);
      if (run.stepFacing !== foeFacing) misses.push(`${label}: facing ${run.stepFacing}`);
      if (Math.abs(f32(run.stepZ - run.foeZ)) > 1.0) misses.push(`${label}: height ${run.stepZ} vs ${run.foeZ}`);
      if (run.stepGrounded === air) misses.push(`${label}: grounded ${run.stepGrounded}`);
      if (run.kickDamage !== 7.0) misses.push(`${label}: kick damage ${run.kickDamage}`);
      if (run.launchZ <= 0.0 || Math.abs(run.launchX) > f32(run.launchZ * f32(0.1))) misses.push(`${label}: launch ${run.launchX}, ${run.launchZ}`);
    }
  }
  assertEquals(misses.join("; "), "", "Wind Walk counters");
});

test("Blademaster's air Wind Walk whiff travels no farther sideways than 0.1H of drift and leaves him free, not helpless, after its end lag [k1 scenario]", () => {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: 1 }, { character: Character.rifleman, x: FOE_X, facing: -1 }]);
  const blademaster = fighter(s, 0);
  airborne(blademaster, 0.0, f32(mainDeckZ(0) + AIR_WHIFF_HEIGHT));
  let ended = 0;
  for (let n = 1; n <= WIND_WALK_END + 1 && ended === 0; n++) {
    frame(s, n === 1 ? [Action.moveRight, Action.special] : []);
    if (n === 1) assertEquals(blademaster.special.action, SpecialAction.heroSide, "air Wind Walk starts");
    if (blademaster.special.action === SpecialAction.none) ended = n;
  }
  assertLessThan(Math.abs(blademaster.motion.x), AIR_WHIFF_DRIFT);
  assertEquals(ended, WIND_WALK_END, "whiff ends on its last frame");
  assertFalse(blademaster.special.fall);
});

test("A rollback from inside a Wind Walk counter's freeze replays the same step behind and kick [k1 scenario]", () => {
  const state = createReplaySnapshot();
  const blademaster = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(blademaster, createFighter(Character.blademaster, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.rifleman, COUNTER_GAP, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 523;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const held = (tick: number, slot: number): number => slot === 0 ? (tick === 1 ? maskOf(Action.moveRight, Action.special) : 0) : tick === 10 ? maskOf(Action.attack) : 0;
  const tickOnce = (tick: number) => {
    for (const slot of [0, 1]) {
      const mask = held(tick, slot);
      const row = inputRow({ held: mask, pressed: mask, axisX: slot === 0 && tick === 1 ? 127 : 0, specialX: slot === 0 && tick === 1 ? 1 : 0 });
      if (row === undefined) throw new Error("input row");
      adaptInput(row, fighterAt(state.world, slot), tick, at(state.controls.inputs, slot), at(state.controls.commands, slot));
    }
    stepMatch(state.match, state.world, state.controls, tick);
  };
  const snapshot = createReplaySnapshot();
  let saved = 0;
  for (let tick = 1; tick <= COUNTER_WATCH; tick++) {
    tickOnce(tick);
    if (saved === 0 && blademaster.special.form >= FOLLOW_UP_FORM && blademaster.special.frame === 3) {
      saved = tick;
      copyReplayState(snapshot, state);
    }
  }
  assertGreaterThan(saved, 0);
  assertGreaterThan(foe.status.damage, 0.0);
  const expected = canonicalState(state);
  copyReplayState(state, snapshot);
  for (let tick = saved + 1; tick <= COUNTER_WATCH; tick++) tickOnce(tick);
  assertEquals(canonicalState(state), expected, "replayed state");
});

const KICK_WATCH = 300;
const KILL_PERCENT = 160.0;
const SURVIVE_PERCENT = 120.0;

function kickKills(percent: number): boolean {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: 1 }, { character: Character.rifleman, x: COUNTER_GAP, facing: -1 }]);
  const foe = fighter(s, 1);
  foe.status.damage = percent;
  for (let n = 1; n <= KICK_WATCH; n++) {
    frame(s, n === 1 ? [Action.moveRight, Action.special] : [], n === 10 ? [Action.attack] : []);
    if (foe.status.out) return true;
  }
  return false;
}

test("Wind Walk's counter kick launches Rifleman out the top at centre stage from 160% and not at 120% [k3 measure docs/design/kit-review-1.md]", () => {
  assertEquals(`${kickKills(SURVIVE_PERCENT)} ${kickKills(KILL_PERCENT)}`, "false true", "kills at 120%, 160%");
});


test("Mirror Image still stands on frame 209 after placement and is gone on frame 210 [k3 measure #500]", () => {
  const state = createReplaySnapshot();
  const blademaster = fighterAt(state.world, 0);
  copyFighterState(blademaster, createFighter(Character.blademaster, BLADEMASTER_X, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.rifleman, FOE_X, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 500;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  let lastAge = 0;
  for (let tick = 1; tick <= MIRROR_IMAGE_OBJECT.frame + IMAGE_LIFE_FRAMES; tick++) {
    const row = inputRow({ held: tick === 1 ? maskOf(Action.moveDown, Action.special) : 0,
      pressed: tick === 1 ? maskOf(Action.special) : 0, axisZ: tick === 1 ? -127 : 0, specialZ: tick === 1 ? -1 : 0 });
    if (row === undefined) throw new Error("Blademaster input row");
    adaptInput(row, blademaster, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (tick === 1) assertEquals(blademaster.special.action, SpecialAction.heroDown, "Blademaster starts Mirror Image");
    const image = placedObject(blademaster);
    if (image.age === lastAge) continue;
    assertEquals(image.age, lastAge + 1, `tick ${tick}: the image ages one frame`);
    lastAge = image.age;
    assertEquals(image.life > 0, image.age < IMAGE_LIFE_FRAMES, `frame ${image.age} after placement: the image stands only before frame ${IMAGE_LIFE_FRAMES}`);
  }
  assertEquals(lastAge, IMAGE_LIFE_FRAMES, "the image reaches its last frame");
  assertEquals(MIRROR_IMAGE_OBJECT.life, IMAGE_LIFE_FRAMES, "Mirror Image life");
});


interface UpSpecialRun {
  readonly label: string;
  readonly helplessAtEnd: boolean | undefined;
  readonly landed: boolean;
  readonly lag: number;
}

function upSpecialRun(air: boolean, ex: boolean, aim: readonly Action[]): UpSpecialRun {
  const s = scene(0, [{ character: Character.blademaster, x: BLADEMASTER_X, facing: 1 }, { character: Character.rifleman, x: FOE_X, facing: -1 }]);
  const blademaster = fighter(s, 0);
  fillMeter(blademaster);
  if (air) airborne(blademaster, BLADEMASTER_X, f32(mainDeckZ(0) + UP_SPECIAL_HOP));
  const label = `${air ? "aerial" : "grounded"}${ex ? " EX" : ""} aim actions ${aim.join("+")}`;
  let helplessAtEnd: boolean | undefined;
  let leftGround = air;
  for (let n = 1; n <= UP_SPECIAL_WATCH; n++) {
    frame(s, n === 1 ? [Action.moveUp, Action.special, ...(ex ? [Action.strong] : [])] : aim);
    if (n === 1 && blademaster.special.action !== SpecialAction.heroUp) return { label, helplessAtEnd, landed: false, lag: 0 };
    if (helplessAtEnd === undefined && blademaster.special.action === SpecialAction.none) helplessAtEnd = blademaster.special.fall;
    leftGround ||= !blademaster.motion.grounded;
    if (leftGround && blademaster.motion.grounded) return { label, helplessAtEnd, landed: true, lag: blademaster.landing.lag };
  }
  return { label, helplessAtEnd, landed: false, lag: 0 };
}

const UP_SPECIAL_AIMS: readonly (readonly Action[])[] = [
  [Action.moveUp], [Action.moveUp, Action.moveRight], [Action.moveUp, Action.moveLeft], [Action.moveLeft], [Action.moveRight],
];
const ONTO_THE_DECK_AIMS = UP_SPECIAL_AIMS.filter(aim => !aim.includes(Action.moveLeft));
const leavesTheDeck =(air: boolean, aim: readonly Action[]): boolean => air || aim.includes(Action.moveUp);

test("Blademaster's Rising Whirlwind ends in helpless fall when it ends airborne, from the ground or a hop, EX or not, aimed up, diagonal or sideways [k1 scenario]", () => {
  const misses: string[] = [];
  for (const air of [false, true]) {
    for (const ex of [false, true]) {
      for (const aim of UP_SPECIAL_AIMS.filter(each => leavesTheDeck(air, each))) {
        const run = upSpecialRun(air, ex, aim);
        if (run.helplessAtEnd !== true) misses.push(`${run.label}: helpless ${run.helplessAtEnd}`);
      }
    }
  }
  assertEquals(misses.join("; "), "", "Rising Whirlwind endings");
});

test("Blademaster lands from Rising Whirlwind in at least his longest aerial landing lag, after the helpless fall and when he lands during the move [k3 measure docs/gameplay-design.md]", () => {
  const tuning = fighter(scene(0, [{ character: Character.blademaster, x: BLADEMASTER_X, facing: 1 }, { character: Character.rifleman, x: FOE_X, facing: -1 }]), 0).tuning;
  const aerials = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir];
  const longestAerial = Math.max(...aerials.map(style => attackLandingLag(style, tuning.moves)));
  const short: string[] = [];
  const runs: readonly UpSpecialRun[] = [
    ...[false, true].flatMap(ex => ONTO_THE_DECK_AIMS.map(aim => upSpecialRun(true, ex, aim))),
    ...[false, true].flatMap(ex => ONTO_THE_DECK_AIMS.filter(aim => leavesTheDeck(false, aim)).map(aim => upSpecialRun(false, ex, aim))),
    ...[false, true].map(ex => upSpecialRun(true, ex, [Action.moveDown])),
  ];
  for (const run of runs) {
    if (!run.landed) short.push(`${run.label}: never landed`);
    else if (run.lag < longestAerial) short.push(`${run.label}: lag ${run.lag}`);
  }
  assertEquals(short.join("; "), "", `landing lag under his longest aerial (${longestAerial})`);
});

const STOCK_FIRST_STRIKE_FRAME = 9;
const STOCK_END_FRAME = 24;
const FIRST_STRIKE_FOE_GAP = 130.0;
const FIRST_STRIKE_FOE_HEIGHT = 60.0;

test("Blademaster's Rising Whirlwind first strikes on frame 13, four frames after the stock frame 9, and ends four frames later than its stock frame 24 [k3 measure docs/gameplay-design.md]", () => {
  const s = scene(0, [{ character: Character.blademaster, x: BLADEMASTER_X, facing: 1 }, { character: Character.rifleman, x: f32(BLADEMASTER_X + FIRST_STRIKE_FOE_GAP), facing: -1 }]);
  const blademaster = fighter(s, 0);
  let first = 0;
  for (let n = 1; n <= UP_SPECIAL_WATCH && first === 0; n++) {
    airborne(fighter(s, 1), f32(BLADEMASTER_X + FIRST_STRIKE_FOE_GAP), f32(mainDeckZ(0) + FIRST_STRIKE_FOE_HEIGHT));
    frame(s, n === 1 ? [Action.moveUp, Action.special] : [Action.moveRight]);
    if (n === 1) assertEquals(blademaster.special.action, SpecialAction.heroUp, "Rising Whirlwind starts");
    if (first === 0 && fighter(s, 1).status.damage > 0.0) first = blademaster.special.frame;
  }
  assertEquals(first, STOCK_FIRST_STRIKE_FRAME + RISE_STARTUP, "first strike frame");
  assertEquals(BLADEMASTER_SPECIALS.up.ground.endFrame, STOCK_END_FRAME + RISE_STARTUP, "last frame of the move");
});

const STOCK_IMAGE_FRAME = 8;
const IMAGE_WATCH = 40;

test("Blademaster's Mirror Image, grounded and from a hop, places its image on frame 12 and moves back from frame 13, four frames after the stock frames 8 and 9 [k3 measure docs/gameplay-design.md]", () => {
  const measured: string[] = [];
  for (const air of [false, true]) {
    const s = scene(0, [{ character: Character.blademaster, x: BLADEMASTER_X, facing: 1 }, { character: Character.rifleman, x: FOE_X, facing: -1 }]);
    const blademaster = fighter(s, 0);
    if (air) airborne(blademaster, BLADEMASTER_X, f32(mainDeckZ(0) + UP_SPECIAL_HOP));
    let placed = 0;
    let stepped = 0;
    for (let n = 1; n <= IMAGE_WATCH && (placed === 0 || stepped === 0); n++) {
      frame(s, n === 1 ? [Action.moveDown, Action.special] : []);
      if (n === 1) assertEquals(blademaster.special.action, SpecialAction.heroDown, "Mirror Image starts");
      if (placed === 0 && placedObject(blademaster).life > 0) placed = n;
      if (stepped === 0 && blademaster.motion.x !== BLADEMASTER_X) stepped = n;
    }
    measured.push(`${air ? "aerial" : "grounded"}: image ${placed}, step ${stepped}`);
  }
  assertEquals(measured.join("; "), `grounded: image ${STOCK_IMAGE_FRAME + IMAGE_STARTUP}, step ${STOCK_IMAGE_FRAME + IMAGE_STARTUP + 1}; aerial: image ${STOCK_IMAGE_FRAME + IMAGE_STARTUP}, step ${STOCK_IMAGE_FRAME + IMAGE_STARTUP + 1}`);
  assertEquals(BLADEMASTER_SPECIALS.down.ground.endFrame, STOCK_END_FRAME + IMAGE_STARTUP, "last frame of the move");
});
