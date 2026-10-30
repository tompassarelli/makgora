import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { SELECTABLE_CHARACTERS, fighterName } from "../roster/kits";
import { type Character, LedgeState } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import type { Controls, Roster } from "./roster";
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
const CATCH_FRAMES = 4;
const HOLD_FRAMES = 12;

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

function slide(s: Slide, input: Readonly<Controls>, deck: number): number {
  let speed = 0.0;
  for (let frame = 0; frame < LEDGE_WINDOW && s.f.motion.surface === deck && s.f.motion.x !== edgeOf(s.stage, deck, s.side); frame++) {
    stepDuel(s.world, input, controls(), s.stage);
    speed = f32(s.f.motion.deltaX * s.side);
  }
  return speed;
}

function left(s: Slide, deck: number): boolean {
  return s.f.motion.surface !== deck && s.f.landing.lag === 0;
}

function awaitLedge(s: Slide): boolean {
  for (let frame = 0; frame < CATCH_FRAMES && s.f.ledge.state !== LedgeState.hang; frame++) settle(s, 1);
  return s.f.ledge.state === LedgeState.hang;
}

function fell(s: Slide, deck: number, hung: boolean, edge: number): boolean {
  return (deck !== MAIN || (!hung && s.f.ledge.state === LedgeState.none)) && f32(s.f.motion.x * s.side) > f32(edge * s.side);
}

function check(problems: string[], ok: boolean, s: Slide, tag: string, what: string): void {
  if (ok) return;
  const { motion, ledge, landing } = s.f;
  problems.push(`${tag} ${what} [x ${motion.x} edge ${edgeOf(s.stage, s.deck, s.side)} z ${motion.z} grounded ${motion.grounded} surface ${motion.surface} ledge ${ledge.state} lag ${landing.lag} vx ${motion.vx} dz ${motion.deltaZ}]`);
}

const report = (problems: readonly string[]): void => assertEquals(problems.slice(0, 5).join("\n"), "");

for (const character of SELECTABLE_CHARACTERS) {
  test(`Wavedash edge: ${fighterName(character)}'s waveland in lag stops in a teeter at an edge he faces unless the stick is held toward it, and slides off an edge at his back with its speed, grabbing the main deck's ledge unless down is held, in both facings on every stage [k1 scenario]`, () => {
    const problems: string[] = [];
    let counts = { teeters: 0, forwards: 0, grabs: 0, falls: 0, held: 0 };
    for (const stage of stageList()) {
      for (const deck of slideSurfaces(stage)) {
        for (const side of [1, -1]) {
          for (const facing of [1, -1]) {
            const edge = edgeOf(stage, deck, side);
            const tag = `stage ${stage} deck ${deck} side ${side} facing ${facing}`;
            const faces = facing === side;
            const released = waveland(character, stage, deck, side, facing, LAG_GAP);
            assertGreaterThan(released.f.landing.lag, 0);
            const speed = slide(released, controls(), deck);
            if (faces) {
              const stopped = (): boolean => released.f.motion.grounded && released.f.motion.surface === deck && released.f.motion.x === edge && released.f.ledge.state === LedgeState.none;
              check(problems, stopped() && released.f.landing.lag === 0 && released.f.motion.vx === 0.0, released, tag, "released: teetered at the edge with the lag cancelled");
              settle(released, HOLD_FRAMES);
              check(problems, stopped(), released, tag, "released: kept teetering");
              counts.teeters++;
            } else {
              check(problems, left(released, deck) && speed > 0.0, released, tag, "released: slid off keeping its speed");
              const hung = awaitLedge(released);
              if (deck === MAIN) {
                check(problems, hung && released.f.ledge.side === side, released, tag, "released: grabbed the ledge");
                counts.grabs++;
              } else {
                check(problems, fell(released, deck, hung, edge), released, tag, "released: fell off the platform");
                counts.falls++;
              }
            }
            const toward = waveland(character, stage, deck, side, facing, LAG_GAP);
            const pull = faces ? controls({ direction: side }) : controls({ direction: side, down: true, verticalDirection: -1 });
            const pace = slide(toward, pull, deck);
            check(problems, left(toward, deck) && pace > 0.0, toward, tag, "held: slid off keeping its speed");
            check(problems, fell(toward, deck, false, edge), toward, tag, "held: fell with no ledge catch");
            if (faces) counts.forwards++;
            else counts.held++;
          }
        }
      }
    }
    report(problems);
    for (const count of Object.values(counts)) assertGreaterThan(count, 0);
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
