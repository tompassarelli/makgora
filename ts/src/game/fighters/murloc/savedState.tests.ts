import { assertEquals, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { lineTokens, parseRecord, recordTokens } from "wisp/src/runtime/recordText";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { type RowFields, inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { KEYED_BY_ACTION, savedState, savedView, section } from "../../replay/moment";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, DuoOrder } from "../../sim/codes";
import { partnerDeparts } from "../../sim/duoPartner";
import { type Fighter, createFighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { createRoster, fighterAt } from "../../sim/roster";
import { mainDeckRight, mainDeckZ } from "../../sim/stage";

const PARTNER = 2;
const ORDER_TICK = 12;
const SAVE_TICK = 40;
const WATCH_FRAMES = 160;

const DOWN_SPECIAL: RowFields = { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 };

interface Scene { readonly name: string; readonly leader: number; readonly holds: (this: void, partner: Readonly<Fighter>) => boolean; readonly prepare: (this: void, state: ReplayState) => void; readonly casts: readonly number[] }

function duel(leader: number): ReplayState {
  const state = createReplaySnapshot();
  const murloc = createFighter(Character.murloc, 0.0, 1);
  const peon = createFighter(Character.peon, 500.0, -1);
  const world = createRoster(3, leader === 0 ? [murloc, peon] : [peon, murloc]);
  const match = state.match;
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.startHold = 0;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.ultimatesOff = true;
  initializeMatchFighters(match, world);
  return { ...state, world };
}

function knockOff(state: ReplayState): void {
  const partner = fighterAt(state.world, PARTNER);
  partner.motion.grounded = false;
  partner.motion.surface = undefined;
  partner.motion.x = f32(mainDeckRight(0) + 400.0);
  partner.motion.z = f32(mainDeckZ(0) - 60.0);
  setWorldMotionValue(partner.motion.meleeZ, partner.motion.z);
  partner.jump.remaining = 0;
}

const SCENES: readonly Scene[] = [
  { name: "Hold", leader: 0, holds: partner => partner.duo?.order === DuoOrder.hold, prepare: () => undefined, casts: [ORDER_TICK] },
  { name: "Hold from slot 1", leader: 1, holds: partner => partner.duo?.order === DuoOrder.hold, prepare: () => undefined, casts: [ORDER_TICK] },
  { name: "separated", leader: 0, holds: partner => partner.duo?.order === DuoOrder.separated, prepare: knockOff, casts: [] },
  { name: "fainted", leader: 0, holds: partner => partner.status.out, prepare: state => partnerDeparts(state.world, PARTNER), casts: [] },
];

function tick(state: ReplayState, scene: Scene, frame: number): void {
  const foe = 1 - scene.leader;
  const leader = inputRow(scene.casts.includes(frame) ? DOWN_SPECIAL : {});
  const idle = inputRow({});
  if (leader === undefined || idle === undefined) throw new Error("savedState row");
  adaptInput(leader, fighterAt(state.world, scene.leader), frame, at(state.controls.inputs, scene.leader), at(state.controls.commands, scene.leader));
  adaptInput(idle, fighterAt(state.world, foe), frame, at(state.controls.inputs, foe), at(state.controls.commands, foe));
  stepMatch(state.match, state.world, state.controls, frame);
}

function throughText(state: ReplayState): ReplayState {
  const tokens = recordTokens(savedView(state), KEYED_BY_ACTION);
  const record = tokens === undefined ? undefined : parseRecord(lineTokens(section("state", tokens).map(line => line.substring("state ".length))));
  const loaded = record === undefined ? undefined : savedState(record);
  if (loaded === undefined) throw new Error("the saved state did not load");
  const restored = createReplaySnapshot();
  copyReplayState(restored, loaded);
  return restored;
}

test("A Murlocs duel replays equal from a saved mid-match state with Grgl in Hold, separated and fainted [k1 scenario]", () => {
  for (const scene of SCENES) {
    const live = duel(scene.leader);
    scene.prepare(live);
    for (let frame = 1; frame < SAVE_TICK; frame++) tick(live, scene, frame);
    assertEquals(scene.holds(fighterAt(live.world, PARTNER)), true, `${scene.name}: Grgl at the save`);
    const replay = throughText(live);
    assertEquals(canonicalState(replay), canonicalState(live), `${scene.name}: the saved state restores`);
    for (let frame = SAVE_TICK; frame <= WATCH_FRAMES; frame++) {
      tick(live, scene, frame);
      tick(replay, scene, frame);
    }
    assertEquals(canonicalState(replay), canonicalState(live), `${scene.name}: the replay reaches the live state`);
  }
});
