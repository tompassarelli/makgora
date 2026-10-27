import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { airborne, fighter, frame, scene } from "../../match/padScene";
import { createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { SELECTABLE_CHARACTERS, fighterName } from "../../roster/kits";
import { AttackStyle, Character, SpecialAction } from "../../sim/codes";
import { canAttack, isIntangible } from "../../sim/conditions";
import { type Fighter, createFighter, placedObject } from "../../sim/fighter";
import { attackLandingLag } from "../../sim/moves";
import { fighterAt } from "../../sim/roster";
import { mainDeckZ } from "../../sim/stage";
import { length } from "./moves";
import { MIRROR_IMAGE_OBJECT, WIND_WALK_DASH } from "./specials";

const BLADEMASTER_X = -200.0;
const FOE_X = 550.0;
const IMAGE_LIFE_FRAMES = 210;
const UP_SPECIAL_HOP = 120.0;
const UP_SPECIAL_WATCH = 250;

const WIND_WALK_START = f32(-length(f32(1.1)));
const WIND_WALK_HOP = 80.0;
const OVERLAP = length(f32(0.3));
const PUNISH_PRESS = WIND_WALK_DASH.last + 2;
const PUNISH_RUN = 2;
const WIND_WALK_WATCH = 120;
const RECOVERY_HEIGHT = 900.0;
const RECOVERY_REACH = length(f32(2.0));
const RECOVERY_DROP = length(f32(0.1));

type Punish = (self: Fighter, blademaster: Fighter, frame: number) => readonly Action[];
const toward = (self: Fighter, other: Fighter): Action => (other.motion.x >= self.motion.x ? Action.moveRight : Action.moveLeft);
const runInto = (press: Action): Punish => (self, other, frame) =>
  frame < PUNISH_RUN ? [toward(self, other)] : frame === PUNISH_RUN ? [toward(self, other), press] : [];
const DASH_ATTACK = runInto(Action.attack);
const RUNNING_GRAB = runInto(Action.grab);

interface WindWalkPast {
  readonly passed: boolean;
  readonly untouchedPass: boolean;
  readonly punished: boolean;
}

function windWalkPast(character: Character, air: boolean, punish: Punish): WindWalkPast {
  const s = scene(0, [{ character: Character.blademaster, x: WIND_WALK_START, facing: 1 }, { character, x: 0.0, facing: -1 }]);
  const blademaster = fighter(s, 0);
  const foe = fighter(s, 1);
  blademaster.mana.points = 100;
  if (air) airborne(blademaster, WIND_WALK_START, f32(mainDeckZ(0) + WIND_WALK_HOP));
  let passed = false;
  let untouchedPass = true;
  let acted = false;
  for (let n = 1; n <= WIND_WALK_WATCH; n++) {
    const own = n === 1 ? [Action.moveRight, Action.special] : [];
    const theirs = n >= PUNISH_PRESS ? punish(foe, blademaster, n - PUNISH_PRESS) : [];
    frame(s, own, theirs);
    if (n === 1 && blademaster.special.action !== SpecialAction.heroSide) return { passed: false, untouchedPass: false, punished: false };
    if (blademaster.status.damage > 0.0 || blademaster.grab.owner !== undefined) return { passed, untouchedPass, punished: !acted };
    if (n <= WIND_WALK_DASH.last + 1 && Math.abs(f32(blademaster.motion.x - foe.motion.x)) <= OVERLAP && !isIntangible(blademaster)) untouchedPass = false;
    passed ||= blademaster.motion.x > foe.motion.x;
    acted ||= n > 1 && blademaster.special.action === SpecialAction.none && canAttack(blademaster);
    if (acted) break;
  }
  return { passed, untouchedPass, punished: false };
}

test("Blademaster's Wind Walk dashes untouchable through every fighter, grounded and from a hop, and every fighter's dash attack or running grab, pressed after the dash ends, lands before he can act [k3 measure #523]", () => {
  const misses: string[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    for (const air of [false, true]) {
      const label = `${fighterName(character)}, ${air ? "aerial" : "grounded"}`;
      const pass = windWalkPast(character, air, DASH_ATTACK);
      if (!pass.passed) misses.push(`${label}: does not pass`);
      if (!pass.untouchedPass) misses.push(`${label}: tangible while overlapping`);
      if (!pass.punished && !windWalkPast(character, air, RUNNING_GRAB).punished) misses.push(`${label}: no punish`);
    }
  }
  assertEquals(misses.join("; "), "", "Wind Walk whiffs");
});

test("Blademaster's air Wind Walk, his only sideways recovery, carries him at least 2H sideways by the end of its dash and drops him less than 0.1H [k3 measure #523]", () => {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: 1 }, { character: Character.rifleman, x: FOE_X, facing: -1 }]);
  const blademaster = fighter(s, 0);
  blademaster.mana.points = 100;
  airborne(blademaster, 0.0, RECOVERY_HEIGHT);
  for (let n = 1; n <= WIND_WALK_DASH.last + 1; n++) frame(s, n === 1 ? [Action.moveRight, Action.special] : []);
  assertGreaterThan(blademaster.motion.x, RECOVERY_REACH);
  assertGreaterThan(blademaster.motion.z, f32(RECOVERY_HEIGHT - RECOVERY_DROP));
  assertEquals(blademaster.special.action, SpecialAction.heroSide, "still in Wind Walk");
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
  blademaster.mana.points = 100;
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
