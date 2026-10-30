import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../src/game/input/actions";
import { type RowFields, inputRow } from "../src/game/input/inputRow";
import { PARTICIPANT_CAPACITY } from "../src/game/input/participants";
import { Phase, createMatchState } from "../src/game/lobby/lobbyState";
import { adaptInput } from "../src/game/match/inputAdapter";
import { initializeMatchFighters, stepMatch } from "../src/game/match/step";
import { type ReplayState, createReplaySnapshot } from "../src/game/replay/snapshot";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/roster/kits";
import { AttackStyle, Character, ContactKind, DuoOrder, GrabAction } from "../src/game/sim/codes";
import { observeDamageContacts, queueDamageContact } from "../src/game/sim/contacts";
import {
  DUO_CHAIN_CAP, DUO_CHAIN_FREE_FRAMES, DUO_SHIELD_STUN_CAP, HANDOFF_IMMUNE_FRAMES, HANDOFF_REPEAT_IMMUNE_FRAMES,
  HANDOFF_REPEAT_WINDOW_FRAMES, advanceDuoLocks,
} from "../src/game/sim/duoLocks";
import { SHIELD_MAX, createFighter } from "../src/game/sim/fighter";
import { advanceGrabs } from "../src/game/sim/grabs";
import { applyAttackHit } from "../src/game/sim/hits";
import { setWorldMotionValue } from "../src/game/sim/motion";
import { type Roster, createRoster, fighterAt } from "../src/game/sim/roster";
import { contactBatch, controls, hitEffect } from "../src/game/sim/testWorld";

const MRGL = 0;
const FOE = 1;
const GRGL = 2;

const THROW_FRAMES = 120;
const FOE_GAP = 40.0;
const TOSS_FOE_X = 250.0;
const TOSS_PARTNER_X = 20.0;
const TOSS_GRAB_WAIT = 30;
const TOSS_FLIGHT = 120;
const TOSS_DAMAGE = 6.0;

const JAB = hitEffect(3.0, 100.0, 40.0, 0.699999988079071, 0.699999988079071);
const HEAVY = hitEffect(25.0, 100.0, 40.0, 0.699999988079071, 0.699999988079071);
const GRAB_HIT = hitEffect(0.0, 0.0, 0.0, 0.0, 0.0);

export const DUO_RULES = [
  "partner skips a held foe",
  "duo hit chain cap",
  "shieldstun cap",
  "partner hitstun never adds",
  "linked bodies never hit each other",
  "handoff chain limit",
  "pummel count carries across a handoff",
  "toss of Grgl",
] as const;
export type DuoRule = (typeof DUO_RULES)[number];

export interface DuoRow {
  readonly foe: string;
  readonly rule: DuoRule;
  readonly reached: boolean;
  readonly observed: string;
  readonly problems: readonly string[];
}

export interface DuoFoe {
  readonly character: Character;
  readonly name: string;
}

export const DUO_FOES: readonly DuoFoe[] = [Character.rifleman, ...SELECTABLE_CHARACTERS].map((character) => ({ character, name: fighterName(character) }));

interface Finding {
  reached: boolean;
  readonly seen: string[];
  readonly problems: string[];
}

const expect = (finding: Finding, ok: boolean, saw: string, problem: string): void => {
  finding.seen.push(saw);
  if (!ok) finding.problems.push(problem);
};

function finish(foe: DuoFoe, rule: DuoRule, finding: Finding): DuoRow {
  const problems = finding.reached ? finding.problems : [...finding.problems, "the rule was not reached"];
  return { foe: foe.name, rule, reached: finding.reached, observed: finding.seen.join("; "), problems };
}

const finding = (): Finding => ({ reached: false, seen: [], problems: [] });

function trio(foe: DuoFoe): Roster {
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(foe.character, FOE_GAP, -1)]);
  initializeMatchFighters(createMatchState(), world);
  return world;
}

function strike(world: Roster, source: number, effect = JAB, target = FOE): void {
  contactBatch(world, () => queueDamageContact(world, source, target, effect, 1, ContactKind.launch, true, undefined));
}

function settleHit(world: Roster): void {
  const foe = fighterAt(world, FOE);
  foe.launch.hitstun = 0;
  foe.launch.hitlag = 0;
  foe.launch.knockbackX = 0.0;
  foe.launch.knockbackZ = 0.0;
  advanceDuoLocks(world);
}

function hold(world: Roster): void {
  const mrgl = fighterAt(world, MRGL);
  const foe = fighterAt(world, FOE);
  mrgl.grab.target = FOE;
  mrgl.grab.action = GrabAction.hold;
  foe.grab.owner = MRGL;
  foe.grab.grabbedFrames = 90;
}

function grab(world: Roster, slot: number): boolean {
  applyAttackHit(world, slot, FOE, AttackStyle.grab, 1, GRAB_HIT, true, false);
  return fighterAt(world, FOE).grab.owner === slot;
}

function throwFoe(world: Roster, slot: number): boolean {
  const thrower = fighterAt(world, slot);
  const input = Array.from({ length: PARTICIPANT_CAPACITY }, () => controls());
  input[slot] = controls({ grabThrowX: thrower.facing });
  let frame = 0;
  while (thrower.grab.target !== undefined && frame++ < THROW_FRAMES) advanceGrabs(world, input);
  return thrower.grab.target === undefined;
}

function settleThrow(world: Roster, frames: number): void {
  const foe = fighterAt(world, FOE);
  foe.launch.hitstun = 0;
  foe.launch.throwHitstun = false;
  for (let frame = 0; frame < frames; frame++) advanceDuoLocks(world);
}

function partnerSkipsHeldFoe(foe: DuoFoe): DuoRow {
  const found = finding();
  const world = trio(foe);
  const target = fighterAt(world, FOE);
  hold(world);
  strike(world, GRGL);
  found.reached = true;
  expect(found, target.status.damage === 0.0, `partner tilt dealt ${target.status.damage}%`, "the partner's tilt hurt a foe his leader holds");
  expect(found, target.grab.owner === MRGL && target.grab.grabbedFrames === 90, `hold ${target.grab.owner === MRGL ? "kept" : "released"}`, "the partner's tilt released or aged the held foe");
  contactBatch(world, () => queueDamageContact(world, MRGL, FOE, JAB, 1, ContactKind.pummel, true, undefined));
  expect(found, target.status.damage > 0.0, "leader pummel lands", "the leader's own pummel no longer lands");
  return finish(foe, "partner skips a held foe", found);
}

function duoChainCap(foe: DuoFoe): DuoRow {
  const found = finding();
  const world = trio(foe);
  const target = fighterAt(world, FOE);
  let stunned = 0;
  for (let hit = 0; hit < DUO_CHAIN_CAP; hit++) {
    strike(world, hit < DUO_CHAIN_CAP / 2 ? MRGL : GRGL);
    if (target.launch.hitstun > 0) stunned++;
    settleHit(world);
  }
  found.reached = stunned > 0;
  expect(found, stunned === DUO_CHAIN_CAP, `${stunned} of ${DUO_CHAIN_CAP} hits inside the cap stun`, `only ${stunned} of ${DUO_CHAIN_CAP} hits inside the cap stunned`);
  const before = target.status.damage;
  strike(world, MRGL);
  expect(found, target.status.damage > before, "capped hit deals damage", "the capped hit dealt no damage");
  expect(found, target.launch.hitstun === 0 && target.launch.knockbackX === 0.0, `capped hit leaves ${target.launch.hitstun} hitstun`, "the capped hit still stunned or launched");
  for (let frame = 0; frame < DUO_CHAIN_FREE_FRAMES - 2; frame++) settleHit(world);
  strike(world, GRGL);
  expect(found, target.launch.hitstun === 0, "cap holds 19 actionable frames", "19 actionable frames lifted the cap");
  settleHit(world);
  strike(world, MRGL);
  expect(found, target.launch.hitstun > 0, "cap lifts at 20 frames", "20 actionable frames did not lift the cap");
  return finish(foe, "duo hit chain cap", found);
}

function shieldstunCap(foe: DuoFoe): DuoRow {
  const found = finding();
  const world = trio(foe);
  const target = fighterAt(world, FOE);
  target.shield.raised = true;
  let run = 0;
  let longest = 0;
  let cappedHits = 0;
  let nextHit = 0;
  for (let frame = 0; frame < 120; frame++) {
    if (frame === nextHit) {
      nextHit += 8;
      target.shield.energy = SHIELD_MAX;
      const energy = target.shield.energy;
      strike(world, nextHit > 40 ? MRGL : GRGL, HEAVY);
      if (target.shield.stun === 0) {
        cappedHits++;
        if (target.shield.energy >= energy) found.problems.push("a capped hit left the shield untouched");
      }
    }
    run = target.shield.stun > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
    advanceDuoLocks(world);
    target.shield.stun = Math.max(0, target.shield.stun - 1);
  }
  found.reached = longest > 0;
  expect(found, longest === DUO_SHIELD_STUN_CAP, `longest shieldstun run ${longest}`, `the longest shieldstun run was ${longest}, not ${DUO_SHIELD_STUN_CAP}`);
  expect(found, cappedHits > 0, `${cappedHits} capped hits`, "no hit past the cap was reached");
  return finish(foe, "shieldstun cap", found);
}

function partnerHitstun(foe: DuoFoe): DuoRow {
  const found = finding();
  const world = trio(foe);
  const target = fighterAt(world, FOE);
  target.launch.hitstun = 6;
  strike(world, GRGL, HEAVY);
  found.reached = true;
  expect(found, target.launch.hitstun <= 6, `partner hit leaves ${target.launch.hitstun} hitstun`, "the partner's hit extended hitstun");
  expect(found, target.launch.knockbackX !== 0.0 || target.launch.knockbackZ !== 0.0, "partner knockback applies", "the partner's own knockback did not apply");
  target.launch.hitstun = 6;
  target.status.struckBy = MRGL;
  strike(world, MRGL, JAB);
  expect(found, target.launch.hitstun >= 6, "pair hitstun takes the maximum", "the pair's hitstun fell below the standing hitstun");
  return finish(foe, "partner hitstun never adds", found);
}

function linkedBodiesNeverHit(foe: DuoFoe): DuoRow {
  const found = finding();
  const world = trio(foe);
  const grgl = fighterAt(world, GRGL);
  const mrgl = fighterAt(world, MRGL);
  strike(world, MRGL, HEAVY, GRGL);
  strike(world, GRGL, HEAVY, MRGL);
  found.reached = true;
  expect(found, grgl.status.damage === 0.0 && mrgl.status.damage === 0.0, `damage ${mrgl.status.damage}/${grgl.status.damage}`, "a body hurt its linked body");
  strike(world, MRGL);
  expect(found, fighterAt(world, FOE).status.damage > 0.0, "foe is still hit", `${foe.name} could not be hit by the leader`);
  return finish(foe, "linked bodies never hit each other", found);
}

function chain(world: Roster, found: Finding): void {
  const first = grab(world, MRGL);
  const thrown = first && throwFoe(world, MRGL);
  const regrab = thrown && grab(world, GRGL);
  const second = regrab && throwFoe(world, GRGL);
  found.reached = found.reached || first;
  if (!first) found.problems.push("the leader could not grab the foe");
  else if (!thrown) found.problems.push("the leader's throw never released the foe");
  else if (!regrab) found.problems.push("the partner could not regrab out of the leader's throw");
  else if (!second) found.problems.push("the partner's throw never released the foe");
}

function handoffChain(foe: DuoFoe): DuoRow {
  const found = finding();
  const world = trio(foe);
  const target = fighterAt(world, FOE);
  chain(world, found);
  const immune = target.victim?.grabImmuneDuo ?? 0;
  expect(found, immune === HANDOFF_IMMUNE_FRAMES, `second throw sets ${immune} frames`, `the second throw set ${immune} frames of grab immunity, not ${HANDOFF_IMMUNE_FRAMES}`);
  expect(found, !(grab(world, MRGL) || grab(world, GRGL)), "no regrab after the chain", "a body regrabbed out of the second throw");
  settleThrow(world, HANDOFF_IMMUNE_FRAMES - 1);
  expect(found, !(grab(world, MRGL) || grab(world, GRGL)), "shut out at 89 frames", "the foe could be grabbed again before 90 frames");
  settleThrow(world, 1);
  expect(found, grab(world, GRGL), "grabbable at 90 frames", "the foe could not be grabbed again at 90 frames");
  throwFoe(world, GRGL);
  settleThrow(world, HANDOFF_IMMUNE_FRAMES + HANDOFF_REPEAT_WINDOW_FRAMES);
  chain(world, found);
  settleThrow(world, 0);
  const again = fighterAt(world, FOE).victim?.grabImmuneDuo ?? 0;
  expect(found, again === HANDOFF_IMMUNE_FRAMES, `chain after the window sets ${again}`, `a chain after the repeat window set ${again} frames, not ${HANDOFF_IMMUNE_FRAMES}`);
  const repeat = trio(foe);
  chain(repeat, finding());
  settleThrow(repeat, HANDOFF_IMMUNE_FRAMES);
  chain(repeat, finding());
  const doubled = fighterAt(repeat, FOE).victim?.grabImmuneDuo ?? 0;
  expect(found, doubled === HANDOFF_REPEAT_IMMUNE_FRAMES, `repeat chain sets ${doubled}`, `a repeat chain set ${doubled} frames, not ${HANDOFF_REPEAT_IMMUNE_FRAMES}`);
  return finish(foe, "handoff chain limit", found);
}

function pummelCarry(foe: DuoFoe): DuoRow {
  const found = finding();
  const world = trio(foe);
  found.reached = grab(world, MRGL);
  const mrgl = fighterAt(world, MRGL);
  mrgl.grab.pummels = 3;
  mrgl.grab.action = GrabAction.hold;
  throwFoe(world, MRGL);
  const regrab = grab(world, GRGL);
  expect(found, regrab, "partner regrabs", "the partner could not regrab out of the throw");
  const carried = fighterAt(world, GRGL).grab.pummels;
  expect(found, carried === 3, `partner starts at ${carried} pummels`, `the partner started at ${carried} pummels, not the leader's 3`);
  return finish(foe, "pummel count carries across a handoff", found);
}

const GRAB_ROW: RowFields = { held: maskOf(Action.grab), pressed: maskOf(Action.grab) };
const THROW_FORWARD_ROW: RowFields = { held: maskOf(Action.moveRight), pressed: maskOf(Action.moveRight), axisX: 127, throwX: 1 };

function tossDuel(foe: DuoFoe): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(foe.character, TOSS_FOE_X, -1)]);
  const match = state.match;
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.startHold = 0;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.ultimatesOff = true;
  initializeMatchFighters(match, world);
  const partner = fighterAt(world, GRGL);
  partner.motion.x = f32(TOSS_PARTNER_X);
  setWorldMotionValue(partner.motion.meleeX, partner.motion.x);
  return { ...state, world };
}

function tick(state: ReplayState, frame: number, row: RowFields): void {
  const leader = inputRow(row);
  const idle = inputRow({});
  if (leader === undefined || idle === undefined) throw new Error("toss row");
  adaptInput(leader, fighterAt(state.world, MRGL), frame, state.controls.inputs[MRGL], state.controls.commands[MRGL]);
  adaptInput(idle, fighterAt(state.world, FOE), frame, state.controls.inputs[FOE], state.controls.commands[FOE]);
  stepMatch(state.match, state.world, state.controls, frame);
}

function tossGrgl(foe: DuoFoe): DuoRow {
  const found = finding();
  const state = tossDuel(foe);
  const hits: number[] = [];
  observeDamageContacts((source, target, damage) => {
    if (source === GRGL && target === FOE) hits.push(damage);
  });
  const leader = fighterAt(state.world, MRGL);
  const partner = fighterAt(state.world, GRGL);
  let frame = 1;
  tick(state, frame++, GRAB_ROW);
  for (let wait = 0; wait < TOSS_GRAB_WAIT && leader.grab.target === undefined; wait++) tick(state, frame++, {});
  const lifted = leader.grab.target === GRGL;
  for (let wait = 0; wait < TOSS_GRAB_WAIT && leader.grab.target !== undefined; wait++) tick(state, frame++, THROW_FORWARD_ROW);
  found.reached = lifted;
  const tossed = partner.duo?.order === DuoOrder.tossed;
  expect(found, tossed, `Grgl order ${tossed ? "tossed" : partner.duo?.order}`, "Mrgl's throw did not leave Grgl tossed");
  let farthest = partner.motion.x;
  for (let flight = 0; flight < TOSS_FLIGHT; flight++) {
    tick(state, frame++, {});
    farthest = Math.max(farthest, partner.motion.x);
  }
  observeDamageContacts(undefined);
  const damage = hits[0] ?? 0;
  const absorbs = foe.character === Character.murloc;
  expect(found, hits.length === 1 && damage === TOSS_DAMAGE, `foe hit ${hits.length} time${hits.length === 1 ? "" : "s"} for ${damage}%`, `the toss hit ${hits.length} times for ${damage}%, not once for ${TOSS_DAMAGE}%`);
  const order = partner.duo?.order;
  const landed = order !== DuoOrder.hold && order !== DuoOrder.tossed && partner.motion.grounded;
  expect(found, landed, landed ? "Grgl landed back on the copied input" : "Grgl did not land back on the copied input", "Grgl did not land grounded out of Hold and the toss");
  expect(found, farthest > TOSS_FOE_X || absorbs, `reach ${Math.round(farthest)} units`, "the toss did not carry past the foe");
  return finish(foe, "toss of Grgl", found);
}

const SCENARIOS: readonly (readonly [DuoRule, (foe: DuoFoe) => DuoRow])[] = [
  ["partner skips a held foe", partnerSkipsHeldFoe],
  ["duo hit chain cap", duoChainCap],
  ["shieldstun cap", shieldstunCap],
  ["partner hitstun never adds", partnerHitstun],
  ["linked bodies never hit each other", linkedBodiesNeverHit],
  ["handoff chain limit", handoffChain],
  ["pummel count carries across a handoff", pummelCarry],
  ["toss of Grgl", tossGrgl],
];

export function duoRows(foe: DuoFoe): DuoRow[] {
  return SCENARIOS.map(([, scenario]) => scenario(foe));
}

export function duoReport(rows: readonly DuoRow[]): { readonly lines: string[]; readonly problems: string[] } {
  const lines = DUO_RULES.map((rule) => {
    const own = rows.filter((row) => row.rule === rule);
    const reached = own.filter((row) => row.reached).length;
    const clean = own.filter((row) => row.problems.length === 0).length;
    return `${rule}: reached against ${reached}/${own.length} fighters, ${clean}/${own.length} as designed`;
  });
  const problems = rows.flatMap((row) => row.problems.map((problem) => `Murlocs ${row.rule} against ${row.foe}: ${problem}`));
  return { lines, problems };
}
