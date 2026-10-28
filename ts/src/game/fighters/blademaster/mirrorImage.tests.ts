import { assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
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
import { BLADEMASTER_SPECIALS, MIRROR_IMAGE_OBJECT } from "./specials";
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

test("Side-B Mirror Image leaves the image where he stood and steps him one length the way the stick points, turning him for a reverse input, grounded and once per airtime in the air with no rise [k1 scenario]", () => {
  const measured = [false, true].flatMap(air => [Action.moveRight, Action.moveLeft].map(stick => sideStep(air, stick)));
  assertEquals(measured.join("; "), [
    "ground right: facing 1, step 1, image where he stood true, rose false",
    "ground left: facing -1, step -1, image where he stood true, rose false",
    "air right: facing 1, step 1, image where he stood true, rose false, no second step",
    "air left: facing -1, step -1, image where he stood true, rose false, no second step",
  ].join("; "));
});

test("Side-B Mirror Image steps him the way the stick is held during the cast while he keeps facing where side-B was pressed, grounded and in the air [k1 scenario]", () => {
  const measured = [false, true].flatMap(air => [
    sideStep(air, Action.moveRight, Action.moveLeft),
    sideStep(air, Action.moveLeft, Action.moveRight),
    sideStep(air, Action.moveRight, Action.moveRight),
    sideStep(air, Action.moveRight, Action.moveUp),
  ]);
  assertEquals(measured.join("; "), [
    "ground right: facing 1, step -1, image where he stood true, rose false",
    "ground left: facing -1, step 1, image where he stood true, rose false",
    "ground right: facing 1, step 1, image where he stood true, rose false",
    "ground right: facing 1, step 1, image where he stood true, rose false",
    "air right: facing 1, step -1, image where he stood true, rose false, no second step",
    "air left: facing -1, step 1, image where he stood true, rose false, no second step",
    "air right: facing 1, step 1, image where he stood true, rose false, no second step",
    "air right: facing 1, step 1, image where he stood true, rose false, no second step",
  ].join("; "));
});

test("Side-B Mirror Image follows the stick only until its aim frames end [k1 scenario]", () => {
  const aim = BLADEMASTER_SPECIALS.side.ground.aimFrames ?? 0;
  const early = sideStep(false, Action.moveRight, Action.moveLeft, aim);
  const late = sideStep(false, Action.moveRight, Action.moveLeft, aim + 1);
  assertEquals(`${early}; ${late}`, [
    "ground right: facing 1, step -1, image where he stood true, rose false",
    "ground right: facing 1, step 1, image where he stood true, rose false",
  ].join("; "));
});

const AIM_ROLLBACK_WATCH = 40;
const AIM_ROLLBACK_SAVE = 6;
const AIM_HOLD_LEFT_LAST = 4;
const AIM_HOLD_RIGHT = { first: 8, last: 10 };

function aimMatch() {
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

function aimTick(state: ReturnType<typeof aimMatch>, tick: number, holdsRightLater: boolean): void {
  for (const slot of [0, 1]) {
    const press = slot === 0 && tick === 1;
    const left = slot === 0 && tick > 1 && tick <= AIM_HOLD_LEFT_LAST;
    const right = slot === 0 && holdsRightLater && tick >= AIM_HOLD_RIGHT.first && tick <= AIM_HOLD_RIGHT.last;
    const mask = press ? maskOf(Action.moveRight, Action.special) : left ? maskOf(Action.moveLeft) : right ? maskOf(Action.moveRight) : 0;
    const row = inputRow({ held: mask, pressed: press ? mask : 0, axisX: press || right ? 127 : left ? -127 : 0, specialX: press ? 1 : 0 });
    if (row === undefined) throw new Error("input row");
    adaptInput(row, fighterAt(state.world, slot), tick, at(state.controls.inputs, slot), at(state.controls.commands, slot));
  }
  stepMatch(state.match, state.world, state.controls, tick);
}

test("A rollback from inside Mirror Image's aim frames onto inputs that no longer hold right replays the step the earlier left hold chose, as straight play does [k1 scenario]", () => {
  const reference = aimMatch();
  for (let tick = 1; tick <= AIM_ROLLBACK_WATCH; tick++) aimTick(reference, tick, false);
  const referee = fighterAt(reference.world, 0);
  assertLessThan(f32(referee.motion.x - placedObject(referee).x), 0.0);
  assertEquals(referee.facing, 1, "still facing the side-B way");

  const state = aimMatch();
  const snapshot = createReplaySnapshot();
  for (let tick = 1; tick <= AIM_ROLLBACK_WATCH; tick++) {
    aimTick(state, tick, true);
    if (tick === AIM_ROLLBACK_SAVE) copyReplayState(snapshot, state);
  }
  assertGreaterThan(f32(fighterAt(state.world, 0).motion.x - placedObject(fighterAt(state.world, 0)).x), 0.0);
  copyReplayState(state, snapshot);
  for (let tick = AIM_ROLLBACK_SAVE + 1; tick <= AIM_ROLLBACK_WATCH; tick++) aimTick(state, tick, false);
  assertEquals(canonicalState(state), canonicalState(reference), "replayed state");
});
