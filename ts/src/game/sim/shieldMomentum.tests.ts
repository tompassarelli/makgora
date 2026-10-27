import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../input/actions";
import { type Scene, airborne, fighter, frame, solo } from "../match/padScene";
import { Character, GroundAction } from "./codes";
import { type Fighter } from "./fighter";

const STAGE = 0;
const START_X = -200.0;
const RUN_FRAMES = 40;
const LANDING_HEIGHT = 3.0;
const FRAME_LIMIT = 90;
const SHIELD_HOLD_FRAMES = 10;
const RIGHT = [Action.moveRight] as const;
const SHIELD = [Action.rightTrigger] as const;

interface Entry { readonly name: string; readonly approach: (s: Scene) => void }

const ENTRIES: readonly Entry[] = [
  { name: "run", approach: s => { for (let i = 0; i < RUN_FRAMES; i++) frame(s, RIGHT); } },
  {
    name: "landing at full air speed", approach: s => {
      const f = fighter(s);
      frame(s, []);
      airborne(f, f.motion.x, f32(f.motion.z + LANDING_HEIGHT));
      f.motion.vx = f.tuning.physics.airSpeed;
    },
  },
];

function meleeDrag(f: Readonly<Fighter>, vx: number): number {
  const { traction, walkSpeed } = f.tuning.physics;
  const drag = Math.abs(vx) > walkSpeed ? f32(traction * 2.0) : traction;
  return vx > 0 ? Math.max(0.0, f32(vx - drag)) : Math.min(0.0, f32(vx + drag));
}

test("Shield momentum: out of a run or a landing, every grounded frame of a held shield loses Melee's traction, doubled above walk speed, until it stops [k4 reference melee]", () => {
  for (const character of [Character.rifleman, Character.jaina]) {
    for (const entry of ENTRIES) {
      const s = solo(STAGE, character, START_X);
      const f = fighter(s);
      entry.approach(s);
      let shielded = 0;
      let doubled = 0;
      for (let n = 0; n < FRAME_LIMIT && (f.motion.vx !== 0 || !f.motion.grounded); n++) {
        const before = f.motion.vx;
        const wasGrounded = f.motion.grounded;
        frame(s, wasGrounded ? SHIELD : []);
        if (!wasGrounded || !f.motion.grounded) continue;
        assertEquals(f.motion.vx, meleeDrag(f, before), `${entry.name}, character ${character}, frame ${n}`);
        if (f.shield.raised) shielded++;
        if (Math.abs(before) > f.tuning.physics.walkSpeed) doubled++;
      }
      assertEquals(f.motion.vx, 0.0, `${entry.name}, character ${character} stops`);
      assertGreaterThan(shielded, 0);
      assertTrue(entry.name.startsWith("landing") || doubled > 0);
    }
  }
});

function lastInitialDashFrame(character: Character): number {
  const s = solo(STAGE, character, START_X);
  const f = fighter(s);
  let frames = 0;
  for (let n = 0; n < FRAME_LIMIT; n++) {
    frame(s, RIGHT);
    if (f.ground.action !== GroundAction.dash) return frames;
    frames++;
  }
  return frames;
}

test("Shield stop: a shield raised on the first, third or last frame of the initial dash stops dead on its first frame and holds still while held [k4 reference melee]", () => {
  for (const character of [Character.rifleman, Character.jaina]) {
    const last = lastInitialDashFrame(character);
    assertGreaterThan(last, 3);
    for (const dashFrames of [1, 3, last]) {
      const s = solo(STAGE, character, START_X);
      const f = fighter(s);
      for (let i = 0; i < dashFrames; i++) frame(s, RIGHT);
      const label = `character ${character}, ${dashFrames} dash frames`;
      assertEquals(f.ground.action, GroundAction.dash, label);
      assertTrue(f.motion.vx > 0);
      frame(s, SHIELD);
      assertTrue(f.shield.raised);
      assertEquals(f.motion.vx, 0.0, label);
      const x = f.motion.x;
      for (let n = 0; n < SHIELD_HOLD_FRAMES; n++) {
        frame(s, SHIELD);
        assertEquals(f.motion.vx, 0.0, `${label}, held frame ${n}`);
        assertEquals(f.motion.x, x, `${label}, held frame ${n}`);
      }
    }
  }
});
