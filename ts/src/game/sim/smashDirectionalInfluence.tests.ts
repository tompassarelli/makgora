


import { assertEquals, assertFalse, test } from "wisp/src/runtime/testing";
import { floorMod } from "wisp/src/sim/intMath";
import { clearPulse, neutralDirections, pulsePending, updateDirections } from "../input/directionalInput";
import { firstFighterDifference } from "../replay/difference";
import { copyFighterState } from "../../generated/state/fighterState";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import {
  HIT_TRAVEL, SDI_STEP_DISTANCE, STRING_TRAVEL, beginSmashDirectionalInfluenceHit,
} from "./smashDirectionalInfluence";
import { advanceSolo, controls, withPhysics } from "./testWorld";
import { melee } from "./tuning";

type Mode = "reset-right" | "alternate" | "held" | "wiggle";

export interface SdiFixture {
  readonly name: string;
  readonly hitlag: number;
  readonly hits: number;
  readonly mode: Mode;
}

export interface SdiStep { readonly hit: number; readonly tick: number; readonly dx: number; readonly dz: number; readonly hitlag: number }

export interface SdiMeasurement extends SdiFixture {
  readonly pathWorld: number;
  readonly maxStepWorld: number;
  readonly netWorld: number;
  readonly sdi: number;
  readonly asdi: number;
  readonly out: boolean;
  readonly steps: readonly SdiStep[];
}


export const SDI_FIXTURES: readonly SdiFixture[] = [
  { name: "one-frame", hitlag: 1, hits: 1, mode: "reset-right" },
  { name: "two-frame", hitlag: 2, hits: 1, mode: "reset-right" },
  { name: "light", hitlag: 4, hits: 1, mode: "reset-right" },
  { name: "electric-strong", hitlag: 10, hits: 1, mode: "reset-right" },
  { name: "cap", hitlag: 20, hits: 1, mode: "reset-right" },
  { name: "cap-alternate", hitlag: 20, hits: 1, mode: "alternate" },
  { name: "cap-held", hitlag: 20, hits: 1, mode: "held" },
  { name: "light-three-hit-string", hitlag: 4, hits: 3, mode: "reset-right" },
  { name: "cap-three-hit-string", hitlag: 20, hits: 3, mode: "alternate" },
  { name: "cap-wiggle", hitlag: 20, hits: 1, mode: "wiggle" },
];


function isolatedVictim(): Fighter {
  const f = createFighter(Character.rifleman, 0.0, 1);
  withPhysics(f, { gravity: 0.0, airAcceleration: 0.0, airFriction: 0.0 });
  f.motion.grounded = false;
  f.motion.surface = undefined;
  f.motion.z = 400.0;
  return f;
}


function seedHit(f: Fighter, hitlag: number): void {
  f.launch.hitlag = hitlag;
  f.launch.diPending = true;
  f.launch.diLaunchSpeed = 0.0;
  f.launch.hitstun = 60;
  beginSmashDirectionalInfluenceHit(f.launch);
}

function stick(mode: Mode, tick: number): readonly [number, number] {
  switch (mode) {
    case "reset-right":
    case "held": return [1, 0];
    case "alternate": return [floorMod(tick, 2) === 0 ? 1 : -1, 0];
    case "wiggle": return [1, floorMod(tick, 2) === 0 ? 0 : 1];
  }
}


export function measureSdiFixture(fixture: SdiFixture): SdiMeasurement {
  const f = isolatedVictim();
  const direction = neutralDirections();
  const input = controls();
  const steps: SdiStep[] = [];
  const startX = f.motion.x;
  const startZ = f.motion.z;
  let pathWorld = 0.0;
  let maxStepWorld = 0.0;
  for (let hit = 0; hit < fixture.hits; hit++) {
    seedHit(f, fixture.hitlag);
    for (let tick = 0; tick < fixture.hitlag; tick++) {
      const [x, z] = stick(fixture.mode, tick);
      if (fixture.mode === "reset-right") updateDirections(direction, 0, 0);
      updateDirections(direction, x, z);
      input.direction = direction.heldX;
      input.verticalDirection = direction.heldZ;
      input.sdiPulse = pulsePending(direction);
      input.sdiX = direction.pulseX;
      input.sdiZ = direction.pulseZ;
      const oldX = f.motion.x;
      const oldZ = f.motion.z;
      advanceSolo(f, 0, input, -240.0);
      clearPulse(direction);
      const dx = f.motion.x - oldX;
      const dz = f.motion.z - oldZ;
      const length = Math.sqrt(dx * dx + dz * dz);
      pathWorld += length;
      maxStepWorld = Math.max(maxStepWorld, length);
      steps.push({ hit, tick, dx, dz, hitlag: f.launch.hitlag });
    }
  }
  const netX = f.motion.x - startX;
  const netZ = f.motion.z - startZ;
  return {
    ...fixture, pathWorld, maxStepWorld, netWorld: Math.sqrt(netX * netX + netZ * netZ),
    sdi: f.launch.sdiSerial, asdi: f.launch.asdiSerial, out: f.status.out, steps,
  };
}

const TOLERANCE = 0.0010000000474974513;
const STEP = SDI_STEP_DISTANCE;
test("SDI remains within 72 world units per hit, 144 per string and 18 per tick [k3 measure #70]", () => {
  for (const fixture of SDI_FIXTURES) {
    const measured = measureSdiFixture(fixture);
    assertEquals(measured.maxStepWorld <= STEP + TOLERANCE, true, `${fixture.name} step`);
    assertEquals(measured.pathWorld <= melee(STRING_TRAVEL) + TOLERANCE, true, `${fixture.name} string`);
    for (let hit = 0; hit < fixture.hits; hit++) {
      const hitPath = measured.steps.filter((step) => step.hit === hit).reduce((sum, step) => sum + Math.sqrt(step.dx * step.dx + step.dz * step.dz), 0.0);
      assertEquals(hitPath <= melee(HIT_TRAVEL) + TOLERANCE, true, `${fixture.name} hit ${hit}`);
    }
    assertFalse(measured.out);
  }
});

test("a restored snapshot continues queued SDI identically [k1 scenario]", () => {
  const original = isolatedVictim();
  seedHit(original, 6);
  advanceSolo(original, 0, controls({ direction: 1, sdiPulse: true, sdiX: 1 }), -240.0);
  advanceSolo(original, 0, controls({ direction: -1, sdiPulse: true, sdiX: -1 }), -240.0);
  const restored = isolatedVictim();
  copyFighterState(restored, original, 1);
  for (const f of [original, restored]) {
    for (let tick = 0; tick < 4; tick++) advanceSolo(f, 0, controls({ direction: 1, verticalDirection: 1, sdiPulse: tick === 0, sdiX: 1, sdiZ: 1 }), -240.0);
  }
  assertEquals(firstFighterDifference(original, restored, 1, 1), undefined);
  assertEquals(restored.launch.sdiHitTravel, HIT_TRAVEL);
});
