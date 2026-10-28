import { assertEquals, assertLessThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { airborne, fighter, frame, scene } from "../../match/padScene";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, SpecialAction } from "../../sim/codes";
import { createFighter, mutablePlacedObject, placedObject } from "../../sim/fighter";
import { fighterAt } from "../../sim/roster";
import { mainDeckZ } from "../../sim/stage";
import { length } from "./moves";
import { MIRROR_IMAGE_OBJECT } from "./specials";
import { canonicalState } from "../../replay/canonical";
import { at } from "wisp/src/runtime/lookup";

const BLADEMASTER_X = -200.0;
const FOE_X = 550.0;
const IMAGE_WATCH = 40;

const IMAGE_STEP = length(f32(1.0));
const SIDE_STEP_HEIGHT = 600.0;
const HOLD_LAST = 20;

function sideStep(air: boolean, stick: Action, hold: Action | undefined = undefined, holdFrom = 2): string {
  const s = scene(0, [{ character: Character.blademaster, x: BLADEMASTER_X, facing: 1 }, { character: Character.rifleman, x: FOE_X, facing: -1 }]);
  const blademaster = fighter(s, 0);
  if (air) airborne(blademaster, BLADEMASTER_X, f32(mainDeckZ(0) + SIDE_STEP_HEIGHT));
  const startZ = blademaster.motion.z;
  let risen = false;
  let stood = 0.0;
  for (let n = 1; n <= IMAGE_WATCH; n++) {
    frame(s, n === 1 ? [stick, Action.special] : hold !== undefined && n >= holdFrom && n <= HOLD_LAST ? [hold] : []);
    if (n === 1) assertEquals(blademaster.special.action, SpecialAction.heroSide, "Mirror Image starts");
    if (n === MIRROR_IMAGE_OBJECT.frame) stood = blademaster.motion.x;
    risen ||= blademaster.motion.z > startZ;
  }
  const image = placedObject(blademaster);
  const facing = blademaster.facing;
  const step = Math.round(f32(blademaster.motion.x - image.x) / IMAGE_STEP);
  const imageWhereHeStood = image.life > 0 && image.x === stood && (air || image.x === BLADEMASTER_X);
  let again = "";
  if (air) {
    mutablePlacedObject(blademaster).life = 0;
    frame(s, [stick, Action.special]);
    again = blademaster.special.action === SpecialAction.none ? ", no second step" : ", stepped again";
  }
  return `${air ? "air" : "ground"} ${stick === Action.moveRight ? "right" : "left"}: facing ${facing}, step ${step}, image where he stood ${imageWhereHeStood}, rose ${risen}${again}`;
}

test("Side-B Mirror Image faces the way side is pressed and steps him one length back away from it, leaving the image where he stood, grounded and once per airtime in the air with no rise [k1 scenario]", () => {
  const measured = [false, true].flatMap(air => [Action.moveRight, Action.moveLeft].map(stick => sideStep(air, stick)));
  assertEquals(measured.join("; "), [
    "ground right: facing 1, step -1, image where he stood true, rose false",
    "ground left: facing -1, step 1, image where he stood true, rose false",
    "air right: facing 1, step -1, image where he stood true, rose false, no second step",
    "air left: facing -1, step 1, image where he stood true, rose false, no second step",
  ].join("; "));
});

test("Side-B Mirror Image ignores the stick held after the press, grounded and in the air [k1 scenario]", () => {
  const measured = [false, true].flatMap(air => [
    sideStep(air, Action.moveRight, Action.moveLeft),
    sideStep(air, Action.moveLeft, Action.moveRight),
    sideStep(air, Action.moveRight, Action.moveUp),
  ]);
  assertEquals(measured.join("; "), [
    "ground right: facing 1, step -1, image where he stood true, rose false",
    "ground left: facing -1, step 1, image where he stood true, rose false",
    "ground right: facing 1, step -1, image where he stood true, rose false",
    "air right: facing 1, step -1, image where he stood true, rose false, no second step",
    "air left: facing -1, step 1, image where he stood true, rose false, no second step",
    "air right: facing 1, step -1, image where he stood true, rose false, no second step",
  ].join("; "));
});

const STEP_ROLLBACK_WATCH = 40;
const STEP_ROLLBACK_SAVE = 6;
const HOLD_LEFT = { first: 10, last: 16 };

function mirrorMatch() {
  const state = createReplaySnapshot();
  copyFighterState(fighterAt(state.world, 0), createFighter(Character.blademaster, BLADEMASTER_X, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.rifleman, FOE_X, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 524;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return state;
}

function mirrorTick(state: ReturnType<typeof mirrorMatch>, tick: number, holdsLeftLater: boolean): void {
  for (const slot of [0, 1]) {
    const press = slot === 0 && tick === 1;
    const left = slot === 0 && holdsLeftLater && tick >= HOLD_LEFT.first && tick <= HOLD_LEFT.last;
    const mask = press ? maskOf(Action.moveRight, Action.special) : left ? maskOf(Action.moveLeft) : 0;
    const row = inputRow({ held: mask, pressed: press ? mask : 0, axisX: press ? 127 : left ? -127 : 0, specialX: press ? 1 : 0 });
    if (row === undefined) throw new Error("input row");
    adaptInput(row, fighterAt(state.world, slot), tick, at(state.controls.inputs, slot), at(state.controls.commands, slot));
  }
  stepMatch(state.match, state.world, state.controls, tick);
}

test("A rollback from inside Mirror Image's step onto inputs that no longer hold left replays the same backward step as straight play does [k1 scenario]", () => {
  const reference = mirrorMatch();
  for (let tick = 1; tick <= STEP_ROLLBACK_WATCH; tick++) mirrorTick(reference, tick, false);
  const referee = fighterAt(reference.world, 0);
  assertLessThan(f32(referee.motion.x - placedObject(referee).x), 0.0);
  assertEquals(referee.facing, 1, "still facing the side-B way");

  const state = mirrorMatch();
  const snapshot = createReplaySnapshot();
  for (let tick = 1; tick <= STEP_ROLLBACK_WATCH; tick++) {
    mirrorTick(state, tick, true);
    if (tick === STEP_ROLLBACK_SAVE) copyReplayState(snapshot, state);
  }
  assertLessThan(f32(fighterAt(state.world, 0).motion.x - placedObject(fighterAt(state.world, 0)).x), 0.0);
  copyReplayState(state, snapshot);
  for (let tick = STEP_ROLLBACK_SAVE + 1; tick <= STEP_ROLLBACK_WATCH; tick++) mirrorTick(state, tick, false);
  assertEquals(canonicalState(state), canonicalState(reference), "replayed state");
});
