import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { SELECTABLE_CHARACTERS, fighterName } from "../roster/kits";
import { type Character, LedgeState } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import type { Roster } from "./roster";
import * as stages from "./stage";
import { controls } from "./testWorld";
import { duelPair, lift, stepDuel } from "./testDuel";

const MAIN = 0;
const STAGE_LIMIT = 24;
const LAG_GAP = 12.0;
const SHORT_MARGIN = 40.0;
const DROP = 4.0;
const SETTLE_FRAMES = 3;
const SLIDE_FRAMES = 260;
const LEDGE_WINDOW = 40;

interface Slide { readonly world: Roster; readonly f: Fighter; readonly stage: number; readonly deck: number; readonly side: number }

function edgeOf(stage: number, deck: number, side: number): number {
  return side > 0 ? stages.surfaceRight(stage, deck, 0) : stages.surfaceLeft(stage, deck, 0);
}

function slideSurfaces(stage: number): number[] {
  const out: number[] = [];
  for (let deck = 0; deck < stages.surfaceCount(stage); deck++) {
    if (!stages.surfaceMoves(stage, deck) && stages.surfaceLine(stage, deck) === undefined) out.push(deck);
  }
  return out;
}

function stageList(): number[] {
  const out: number[] = [];
  for (let stage = 0; stage < STAGE_LIMIT; stage++) if (slideSurfaces(stage).length > 0) out.push(stage);
  return out;
}

function waveland(character: Character, stage: number, deck: number, side: number, facing: number, gap: number): Slide {
  const top = stages.surfaceZ(stage, deck, 0);
  const start = f32(edgeOf(stage, deck, side) - side * gap);
  const bystander = side > 0 ? f32(stages.mainDeckLeft(stage) + 120.0) : f32(stages.mainDeckRight(stage) - 120.0);
  const { world, owner } = duelPair(createFighter(character, start, facing), createFighter(character, bystander, -facing), 0, stage);
  owner.motion.z = top;
  owner.motion.grounded = true;
  owner.motion.surface = deck;
  for (let i = 0; i < SETTLE_FRAMES; i++) stepDuel(world, controls(), controls(), stage);
  owner.motion.x = start;
  lift(owner, f32(top + DROP));
  stepDuel(world, controls({ airDodgePressed: true, shield: true, dodgeX: side, dodgeZ: -1, direction: side, verticalDirection: -1 }), controls(), stage);
  return { world, f: owner, stage, deck, side };
}

function settle(s: Slide, frames: number): void {
  for (let i = 0; i < frames; i++) stepDuel(s.world, controls(), controls(), s.stage);
}

function settleToRest(s: Slide): void {
  for (let i = 0; i < SLIDE_FRAMES && s.f.motion.grounded && (s.f.motion.vx !== 0.0 || s.f.landing.lag > 0); i++) settle(s, 1);
}

function slideDistance(character: Character, stage: number): number | undefined {
  const deck = MAIN;
  const middle = f32(f32(stages.surfaceLeft(stage, deck, 0) + stages.surfaceRight(stage, deck, 0)) / 2.0);
  const s = waveland(character, stage, deck, 1, -1, f32(stages.surfaceRight(stage, deck, 0) - middle));
  const from = s.f.motion.x;
  settleToRest(s);
  return s.f.motion.grounded && s.f.motion.surface === deck ? f32(s.f.motion.x - from) : undefined;
}

function check(problems: string[], ok: boolean, s: Slide, tag: string, what: string): void {
  if (ok) return;
  const { motion, ledge, landing } = s.f;
  problems.push(`${tag} ${what} [x ${motion.x} edge ${edgeOf(s.stage, s.deck, s.side)} z ${motion.z} grounded ${motion.grounded} surface ${motion.surface} ledge ${ledge.state} lag ${landing.lag} vx ${motion.vx} dz ${motion.deltaZ}]`);
}

const report = (problems: readonly string[]): void => assertEquals(problems.slice(0, 5).join("\n"), "");

for (const character of SELECTABLE_CHARACTERS) {
  test(`Wavedash edge: ${fighterName(character)}'s waveland toward the edge in lag slides off, grabbing the ledge only with his back to it, and leaves a platform with no ledge to grab, in both facings on every stage [k1 scenario]`, () => {
    const problems: string[] = [];
    let grabs = 0;
    let falls = 0;
    let drops = 0;
    for (const stage of stageList()) {
      for (const deck of slideSurfaces(stage)) {
        for (const side of [1, -1]) {
          for (const facing of [1, -1]) {
            const s = waveland(character, stage, deck, side, facing, LAG_GAP);
            assertGreaterThan(s.f.landing.lag, 0);
            let hung = false;
            for (let frame = 0; frame < LEDGE_WINDOW && !hung; frame++) {
              settle(s, 1);
              hung = s.f.ledge.state === LedgeState.hang;
            }
            const tag = `stage ${stage} deck ${deck} side ${side} facing ${facing}`;
            check(problems, s.f.motion.surface !== deck && s.f.landing.lag === 0, s, tag, "left the surface");
            if (deck === MAIN && facing === -side) {
              check(problems, hung && s.f.ledge.side === side, s, tag, "grabbed the ledge");
              grabs++;
            } else {
              check(problems, (deck !== MAIN || (!hung && s.f.ledge.state === LedgeState.none)) && f32(s.f.motion.x * side) > f32(edgeOf(stage, deck, side) * side), s, tag, "fell without a ledge");
              if (deck === MAIN) falls++;
              else drops++;
            }
          }
        }
      }
    }
    report(problems);
    assertGreaterThan(grabs, 0);
    assertGreaterThan(falls, 0);
    assertGreaterThan(drops, 0);
  });

  test(`Wavedash edge: ${fighterName(character)}'s wavedash that stops short of the edge on traction stays on the deck, in both facings [k1 scenario]`, () => {
    const problems: string[] = [];
    let measured = 0;
    for (const stage of stageList()) {
      const reach = slideDistance(character, stage);
      if (reach === undefined) continue;
      assertGreaterThan(Math.abs(reach), 0.0);
      measured++;
      for (const facing of [1, -1]) {
        const s = waveland(character, stage, MAIN, 1, facing, f32(Math.abs(reach) + SHORT_MARGIN));
        settleToRest(s);
        const tag = `stage ${stage} facing ${facing}`;
        check(problems, s.f.motion.grounded && s.f.motion.surface === MAIN && s.f.ledge.state === LedgeState.none && s.f.motion.x < edgeOf(stage, MAIN, 1), s, tag, "stayed on the deck");
      }
    }
    report(problems);
    assertGreaterThan(measured, 1);
  });
}
