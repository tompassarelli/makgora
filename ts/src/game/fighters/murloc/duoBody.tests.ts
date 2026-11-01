import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { type RowFields, inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { observeDamageContacts } from "../../sim/contacts";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { AttackStyle, Character, LAST_ATTACK_STYLE } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { fighterHurtboxes, type HurtPart } from "../../sim/hurtboxes";
import { createRoster, fighterAt } from "../../sim/roster";
import { MURLOC_MOVES } from "./moves";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const TILT: RowFields = { held: maskOf(Action.attack), pressed: maskOf(Action.attack), axisX: 70 };
const TILT_DAMAGE = MURLOC_MOVES.normals[AttackStyle.forwardTilt]?.regions[0]?.hit.effect.damage ?? 0.0;

function seat(characters: readonly Character[], positions: readonly number[]): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster((1 << characters.length) - 1, characters.map((character, slot) => createFighter(character, positions[slot] ?? 0.0, slot === FOE ? -1 : 1)));
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

function tilt(state: ReplayState, hitter: number): number[] {
  const hits: number[] = [];
  observeDamageContacts((source, target, damage) => {
    if (target === FOE && source === hitter) hits.push(damage);
  });
  for (let tick = 1; tick <= 60; tick++) {
    const row = inputRow(tick === 10 ? TILT : {});
    if (row === undefined) throw new Error("duoBody row");
    adaptInput(row, fighterAt(state.world, LEADER), tick, state.controls.inputs[LEADER], state.controls.commands[LEADER]);
    stepMatch(state.match, state.world, state.controls, tick);
  }
  observeDamageContacts(undefined);
  return hits;
}

function mrglHits(): number[] {
  const state = seat([Character.murloc, Character.peon], [0.0, 50.0]);
  fighterAt(state.world, PARTNER).motion.x = -150.0;
  return tilt(state, LEADER);
}

function grglHits(): number[] {
  const state = seat([Character.murloc, Character.peon], [-150.0, 50.0]);
  fighterAt(state.world, PARTNER).motion.x = 0.0;
  return tilt(state, PARTNER);
}

function soloHits(): number[] {
  const state = seat([Character.murloc, Character.peon, Character.peon, Character.peon], [0.0, 50.0, 400.0, 500.0]);
  return tilt(state, LEADER);
}

function standHeight(state: ReplayState, slot: number): number {
  const part = fighterHurtboxes(fighterAt(state.world, slot)).stand[0];
  if (part === undefined) throw new Error("no stand part");
  return Math.abs(part.z2 - part.z1) + 2.0 * part.radius;
}

test("Grgl's forward tilt deals 0.75 of Mrgl's [k3 measure docs/design/murloc.md]", () => {
  const mrgl = mrglHits();
  const grgl = grglHits();
  assertEquals(mrgl.length, 1, "Mrgl's tilt hits once");
  assertEquals(grgl.length, 1, "Grgl's copied tilt hits once");
  assertEquals(mrgl[0], TILT_DAMAGE, "Mrgl with a live partner deals the authored damage");
  assertEquals(grgl[0], f32(TILT_DAMAGE * 0.75));
});

test("A solo Mrgl's forward tilt deals 0.9 of the authored damage [k3 measure docs/design/murloc.md]", () => {
  const solo = soloHits();
  assertEquals(solo.length, 1, "the solo tilt hits once");
  assertEquals(solo[0], f32(TILT_DAMAGE * f32(0.9)));
});

const partsKey = (parts: readonly HurtPart[]): string => parts.map(part => [part.x1, part.z1, part.x2, part.z2, part.radius].join(",")).join(";");

function footprint(state: ReplayState, slot: number): string {
  const fighter = fighterAt(state.world, slot);
  const moves = fighter.tuning.moves;
  const boxes = fighterHurtboxes(fighter);
  const keys: string[] = [partsKey(boxes.stand), partsKey(boxes.crouch ?? [])];
  for (let style = 0; style <= LAST_ATTACK_STYLE; style++) {
    for (const pose of boxes.attacks[style] ?? []) keys.push(`${style}:${pose.firstFrame}-${pose.lastFrame}:${partsKey(pose.parts)}`);
    for (const region of moves?.normals[style]?.regions ?? []) {
      const { hit } = region;
      const strike = hit.strike;
      keys.push(`${style}:${region.firstFrame}-${region.lastFrame}:${[hit.minX, hit.maxX, hit.minZ, hit.maxZ].join(",")}:${strike === undefined ? "" : [strike.x1, strike.z1, strike.x2, strike.z2, strike.radius].join(",")}`);
    }
  }
  const grab = moves?.grabRegion;
  keys.push(grab === undefined ? "" : [grab.minX, grab.maxX, grab.minZ, grab.maxZ].join(","));
  return keys.join("|");
}

test("Grgl's stand capsule height, hurt capsules, hit regions and grab region equal Mrgl's, and the pair weigh 66 and 60 [k3 measure docs/design/murloc.md]", () => {
  const state = seat([Character.murloc, Character.peon], [0.0, 50.0]);
  assertEquals(standHeight(state, PARTNER), standHeight(state, LEADER));
  assertEquals(footprint(state, PARTNER), footprint(state, LEADER));
  const leader = fighterAt(state.world, LEADER).tuning.physics;
  const partner = fighterAt(state.world, PARTNER).tuning.physics;
  assertEquals(leader.weight, f32(75.0 * f32(0.88)), "Mrgl weighs 0.88");
  assertEquals(partner.weight, f32(75.0 * f32(0.8)), "Grgl weighs 0.80");
  assertEquals(partner.runSpeed, leader.runSpeed, "same run speed");
  assertEquals(partner.airSpeed, leader.airSpeed, "same air speed");
});
