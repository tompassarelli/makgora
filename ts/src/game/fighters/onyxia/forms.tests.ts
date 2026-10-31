import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt } from "../../sim/roster";
import { authoredTuning } from "../../sim/tuning";
import { FORM_SWAP_COOLDOWN, HUMAN_GUISE_FRAMES, REVEAL_FRAMES } from "./specials";

type Press = "reveal" | "jab" | "none";
type Script = (tick: number) => readonly [Press, Press];

interface Duel {
  readonly state: ReplayState;
  readonly onyxia: Fighter;
  readonly foe: Fighter;
  tick: number;
}

const ROWS: Readonly<Record<Press, Parameters<typeof inputRow>[0]>> = {
  reveal: { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 },
  jab: { held: maskOf(Action.attack), pressed: maskOf(Action.attack) },
  none: {},
};

function duel(foeAhead: number): Duel {
  const state = createReplaySnapshot();
  const onyxia = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(onyxia, createFighter(Character.onyxia, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.blademaster, foeAhead, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, onyxia, foe, tick: 0 };
}

function step(d: Duel, [own, other]: readonly [Press, Press]): void {
  d.tick++;
  const first = inputRow(ROWS[own]);
  const second = inputRow(ROWS[other]);
  if (first === undefined || second === undefined) throw new Error("Onyxia's input row");
  adaptInput(first, d.onyxia, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  adaptInput(second, d.foe, d.tick, d.state.controls.inputs[1], d.state.controls.commands[1]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

const REVEAL_AT = 3;
const GUISE_AT = REVEAL_AT + FORM_SWAP_COOLDOWN + 2;
const swapScript: Script = (tick) => [tick === REVEAL_AT || tick === GUISE_AT ? "reveal" : "none", "none"];

test("Reveal turns Lady Katrana Prestor into the dragon on its last frame with the dragon's whole kit and body, and Human Guise turns her back once the shared cooldown ends [k3 measure docs/design/onyxia.md]", () => {
  const d = duel(900.0);
  const dragon = authoredTuning(Character.onyxiaDragon);
  let revealedAt: number | undefined;
  for (let tick = 1; tick <= REVEAL_AT + REVEAL_FRAMES + 2; tick++) {
    step(d, swapScript(tick));
    if (revealedAt === undefined && d.onyxia.character === Character.onyxiaDragon) revealedAt = tick;
  }
  assertEquals(revealedAt, REVEAL_AT + REVEAL_FRAMES - 1);
  assertEquals(d.onyxia.tuning.moves, dragon.moves);
  assertEquals(d.onyxia.tuning.specials, dragon.specials);
  assertEquals(d.onyxia.tuning.physics.weight, dragon.physics.weight);
  assertGreaterThan(d.onyxia.special.cooldowns[SpecialAction.heroDown] ?? 0, 0);
  for (let tick = d.tick + 1; tick < GUISE_AT; tick++) step(d, [tick === REVEAL_AT + REVEAL_FRAMES + 20 ? "reveal" : "none", "none"]);
  assertEquals(d.onyxia.character, Character.onyxiaDragon, "a press while the cooldown runs changes nothing");
  for (let tick = GUISE_AT; tick <= GUISE_AT + HUMAN_GUISE_FRAMES + 2; tick++) step(d, swapScript(tick));
  assertEquals(d.onyxia.character, Character.onyxia);
  assertEquals(d.onyxia.tuning.moves, authoredTuning(Character.onyxia).moves);
});

test("A hit before Reveal's last frame keeps her human, and the cooldown is still spent [k3 measure docs/design/onyxia.md]", () => {
  const d = duel(60.0);
  for (let tick = 1; tick <= REVEAL_AT + REVEAL_FRAMES + 30; tick++) step(d, [tick === REVEAL_AT ? "reveal" : "none", tick === REVEAL_AT + 10 ? "jab" : "none"]);
  assertGreaterThan(d.onyxia.status.damage, 0.0);
  assertEquals(d.onyxia.character, Character.onyxia);
  assertGreaterThan(d.onyxia.special.cooldowns[SpecialAction.heroDown] ?? 0, 0);
});

test("Every stock starts as Lady Katrana Prestor: a dragon who loses a stock respawns human [k3 measure docs/design/onyxia.md]", () => {
  const d = duel(900.0);
  for (let tick = 1; tick <= REVEAL_AT + REVEAL_FRAMES + 2; tick++) step(d, swapScript(tick));
  assertEquals(d.onyxia.character, Character.onyxiaDragon);
  const stocks = d.onyxia.status.stocks;
  d.onyxia.motion.x = 9000.0;
  setWorldMotionValue(d.onyxia.motion.meleeX, 9000.0);
  let respawned = false;
  for (let frame = 0; frame < 400 && !respawned; frame++) {
    step(d, ["none", "none"]);
    respawned = d.onyxia.status.stocks === stocks - 1 && !d.onyxia.status.out;
  }
  assertTrue(respawned);
  assertEquals(d.onyxia.character, Character.onyxia);
  assertEquals(d.onyxia.tuning.moves, authoredTuning(Character.onyxia).moves);
  assertFalse((d.onyxia.special.cooldowns[SpecialAction.heroDown] ?? 0) > 0);
});

function replayFrom(script: Script, end: number, saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(900.0);
  const snapshot = createReplaySnapshot();
  for (let tick = 1; tick <= end; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    step(run, script(tick));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  for (let tick = saveTick; tick <= end; tick++) step(run, script(tick));
  return { expected, replayed: canonicalState(run.state) };
}

test("A rollback replays Reveal into the dragon and Human Guise back to the live checksum from saves before, during and after each swap [k1 scenario]", () => {
  const end = GUISE_AT + HUMAN_GUISE_FRAMES + 20;
  const saves = [2, REVEAL_AT + 20, REVEAL_AT + REVEAL_FRAMES, REVEAL_AT + REVEAL_FRAMES + 5, GUISE_AT, GUISE_AT + HUMAN_GUISE_FRAMES, GUISE_AT + HUMAN_GUISE_FRAMES + 3];
  for (const save of saves) {
    const { expected, replayed } = replayFrom(swapScript, end, save);
    assertEquals(replayed, expected, `saved on tick ${save}`);
  }
});
