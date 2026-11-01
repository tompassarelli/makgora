import "../roster/kits";
import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { neutralControls } from "./roster";
import { advanceShieldTilt, shieldCenterX, shieldCenterZ, shieldReach } from "./shieldTilt";
import { TILT_STICK_DOWN, TILT_STICK_UP, TILT_STICK_X } from "./stick";

const FULL = 1.0;
const BELOW = f32(0.5);

function shielded(facing: number): Fighter {
  const f = createFighter(Character.rifleman, 100.0, facing);
  f.shield.raised = true;
  return f;
}

function centre(facing: number, x: number, z: number): readonly [number, number] {
  const f = shielded(facing);
  const input = neutralControls();
  input.diStickValid = true;
  input.diStickX = x;
  input.diStickZ = z;
  advanceShieldTilt(f, input);
  return [shieldCenterX(f), shieldCenterZ(f)];
}

const PRESSES = [
  { name: "forward", x: FULL, z: 0.0, mod: [TILT_STICK_X, 0.0] },
  { name: "back", x: -FULL, z: 0.0, mod: [-TILT_STICK_X, 0.0] },
  { name: "up", x: 0.0, z: FULL, mod: [0.0, TILT_STICK_UP] },
  { name: "down", x: 0.0, z: -FULL, mod: [0.0, -TILT_STICK_DOWN] },
  { name: "up-forward diagonal", x: FULL, z: FULL, mod: [TILT_STICK_X, TILT_STICK_UP] },
  { name: "down-back diagonal", x: -FULL, z: -FULL, mod: [-TILT_STICK_X, -TILT_STICK_DOWN] },
] as const;

test("a full stick press puts the shield exactly where the tilt modifier's press does, forward, back, up, down and diagonally, facing either way [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    for (const press of PRESSES) {
      const full = centre(facing, press.x, press.z);
      const modifier = centre(facing, press.mod[0], press.mod[1]);
      assertEquals(full[0], modifier[0], `${press.name} facing ${facing}: x`);
      assertEquals(full[1], modifier[1], `${press.name} facing ${facing}: z`);
    }
  }
});

test("a stick press below the cap tilts the shield by the raw stick, unchanged [k1 scenario]", () => {
  const f = shielded(1);
  const input = neutralControls();
  input.diStickValid = true;
  input.diStickX = BELOW;
  input.diStickZ = -BELOW;
  advanceShieldTilt(f, input);
  assertEquals(f.shield.tiltX, BELOW);
  assertEquals(f.shield.tiltZ, -BELOW);
  const [x, z] = centre(1, BELOW, BELOW);
  const [fullX, fullZ] = centre(1, FULL, FULL);
  assertGreaterThan(fullX, x);
  assertGreaterThan(fullZ, z);
});

test("the shield's reach adds exactly the farthest capped tilt to the bubble's offset and radius [k1 scenario]", () => {
  const geometry = shielded(1).tuning.shield;
  const [restX, restZ] = centre(1, 0.0, 0.0);
  const farthest = Math.max(
    ...([[FULL, 0.0], [-FULL, 0.0], [0.0, FULL], [0.0, -FULL]] as const).map(([x, z]) => {
      const [cx, cz] = centre(1, x, z);
      return Math.max(Math.abs(cx - restX), Math.abs(cz - restZ));
    }),
  );
  const offset = Math.max(Math.abs(geometry.centerX), Math.abs(geometry.centerZ));
  assertTrue(Math.abs(shieldReach(geometry) - (offset + farthest + geometry.radius)) < f32(0.001));
});
