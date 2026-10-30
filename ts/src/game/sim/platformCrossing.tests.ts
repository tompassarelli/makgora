import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { SELECTABLE_CHARACTERS, fighterName } from "../roster/kits";
import type { Character } from "./codes";
import { type Fighter, PLATFORM_DROP_INPUT_WINDOW, createFighter } from "./fighter";
import { setWorldMotionValue } from "./motion";
import type { Controls, Roster } from "./roster";
import * as stages from "./stage";
import { controls } from "./testWorld";
import { duelPair, stepDuel } from "./testDuel";

const STAGE_LIMIT = 24;
const START_HEIGHT = 6.0;
const START_SPEED = -1.0;
const CROSS_FRAMES = 30;
const NEUTRAL = controls();
const KEYBOARD_DOWN = controls({ verticalDirection: -1, down: true });
const ANALOG_DOWN = controls({ diStickValid: true, diStickX: 0.0, diStickZ: -1.0, down: true });
const ANALOG_DROP_EDGE = controls({ diStickValid: true, diStickX: 0.0, diStickZ: f32(-0.7), down: true });
const ANALOG_CROUCH_ONLY = controls({ diStickValid: true, diStickX: 0.0, diStickZ: f32(-0.6) });

interface Deck { readonly stage: number; readonly deck: number }
interface Crossing { readonly landed: boolean; readonly lag: number; readonly speedBefore: number; readonly speedAfter: number; readonly zBefore: number; readonly zAfter: number; readonly fastBefore: boolean; readonly fastAfter: boolean }

function check(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

function passDecks(): Deck[] {
  const out: Deck[] = [];
  for (let stage = 0; stage < STAGE_LIMIT; stage++) {
    for (let deck = 0; deck < stages.surfaceCount(stage); deck++) {
      if (stages.surfacePass(stage, deck) && !stages.surfaceMoves(stage, deck) && stages.surfaceLine(stage, deck) === undefined) out.push({ stage, deck });
    }
  }
  return out;
}

function placeAbove(character: Character, at: Deck, fast: boolean, heldDown: boolean): { world: Roster; f: Fighter } {
  const { stage, deck } = at;
  const x = f32((stages.surfaceLeft(stage, deck, 0) + stages.surfaceRight(stage, deck, 0)) / 2);
  const { world, owner } = duelPair(createFighter(character, x, 1), createFighter(character, f32(stages.mainDeckLeft(stage) + 20.0), 1), 0, stage);
  const { motion } = owner;
  const z = f32(stages.surfaceZ(stage, deck, 0) + START_HEIGHT);
  motion.x = x;
  motion.z = z;
  motion.vx = 0.0;
  motion.vz = START_SPEED;
  motion.grounded = false;
  motion.surface = undefined;
  motion.fastFalling = fast;
  setWorldMotionValue(motion.meleeZ, z);
  setWorldMotionValue(motion.meleeVelocityZ, START_SPEED);
  if (heldDown) {
    motion.fastFallDownHeld = true;
    motion.fastFallInputAge = PLATFORM_DROP_INPUT_WINDOW;
    owner.platform.downHeld = true;
  }
  return { world, f: owner };
}

function cross(character: Character, at: Deck, fast: boolean, input: Readonly<Controls>, heldDown: boolean): Crossing {
  const { world, f } = placeAbove(character, at, fast, heldDown);
  const deckZ = stages.surfaceZ(at.stage, at.deck, 0);
  for (let i = 0; i < CROSS_FRAMES; i++) {
    const zBefore = f.motion.z;
    const speedBefore = f.motion.vz;
    const fastBefore = f.motion.fastFalling;
    stepDuel(world, input, NEUTRAL, at.stage);
    if (f.motion.grounded || f.motion.z < deckZ) {
      return { landed: f.motion.grounded && f.motion.surface === at.deck, lag: f.landing.lag, speedBefore, speedAfter: f.motion.vz, zBefore, zAfter: f.motion.z, fastBefore, fastAfter: f.motion.fastFalling };
    }
  }
  throw new Error(`${fighterName(character)} never reached stage ${at.stage} deck ${at.deck}`);
}

function where(character: Character, at: Deck, fast: boolean, name: string): string {
  return `${fighterName(character)} ${fast ? "fast fall" : "fall"} ${name} onto stage ${at.stage} deck ${at.deck}`;
}

function passesEverywhere(inputs: readonly (readonly [string, Readonly<Controls>])[]): void {
  check(passDecks().length > 0, "no fixed pass-through decks found");
  for (const character of SELECTABLE_CHARACTERS) {
    for (const at of passDecks()) {
      for (const fast of [false, true]) {
        for (const [name, input] of inputs) {
          const c = cross(character, at, fast, input, true);
          const label = where(character, at, fast, name);
          check(!c.landed, `${label} landed`);
          assertEquals(c.lag, 0, `${label} landing lag`);
          check(c.speedAfter <= c.speedBefore, `${label} vertical speed ${c.speedBefore} -> ${c.speedAfter} on the crossing frame`);
          check(c.zAfter <= f32(c.zBefore + c.speedBefore), `${label} height ${c.zBefore} -> ${c.zAfter} at speed ${c.speedBefore}`);
          assertEquals(c.fastAfter, c.fastBefore, `${label} fast fall ${c.fastBefore} -> ${c.fastAfter}`);
        }
      }
    }
  }
}

function landsEverywhere(name: string, input: Readonly<Controls>): void {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const at of passDecks()) {
      for (const fast of [false, true]) check(cross(character, at, fast, input, false).landed, `${where(character, at, fast, name)} passed through`);
    }
  }
}

test("Every fighter falling or fast falling onto every pass-through platform with down held past the drop line, on a keyboard or an analog stick, keeps falling at full speed with no grounded frame or landing lag [k1 scenario]", () => {
  passesEverywhere([["keyboard", KEYBOARD_DOWN], ["analog", ANALOG_DOWN], ["analog -0.7", ANALOG_DROP_EDGE]]);
});

test("Every fighter falling or fast falling onto every pass-through platform with the stick released or above the drop line lands on it [k1 scenario]", () => {
  landsEverywhere("neutral", NEUTRAL);
  landsEverywhere("analog -0.6", ANALOG_CROUCH_ONLY);
});
