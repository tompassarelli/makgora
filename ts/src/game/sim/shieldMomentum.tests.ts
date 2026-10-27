import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../input/actions";
import { type Scene, airborne, fighter, frame, solo } from "../match/padScene";
import { Character } from "./codes";
import { type Fighter } from "./fighter";

const STAGE = 0;
const START_X = -200.0;
const RUN_FRAMES = 40;
const LATE_DASH_FRAMES = 12;
const LANDING_HEIGHT = 3.0;
const FRAME_LIMIT = 90;
const RIGHT = [Action.moveRight] as const;
const SHIELD = [Action.rightTrigger] as const;

interface Entry { readonly name: string; readonly approach: (s: Scene) => void }

const ENTRIES: readonly Entry[] = [
  { name: "run", approach: s => { for (let i = 0; i < RUN_FRAMES; i++) frame(s, RIGHT); } },
  { name: "late dash", approach: s => { for (let i = 0; i < LATE_DASH_FRAMES; i++) frame(s, RIGHT); } },
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

test("Shield momentum: out of a run, a late dash or a landing, every grounded frame of a held shield loses Melee's traction, doubled above walk speed, until it stops [k4 reference melee]", () => {
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
