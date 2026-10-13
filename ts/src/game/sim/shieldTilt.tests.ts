import { assertDefined, assertEquals, assertFalse, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../input/adapter";
import { attackBuffer } from "../input/attackBuffer";
import { inputRow } from "../input/inputRow";
import { type HitArea, HitAreaKind, collectHitAreas, createHitAreaList } from "../presentation/hitAreas";
import { projectedShield } from "../presentation/shieldPose";
import { copyFighterState } from "../replay/fighterState";
import { Character } from "./codes";
import { SHIELD_MAX, createFighter } from "./fighter";
import { fighterName, SELECTABLE_CHARACTERS } from "./heroes/registry";
import { neutralControls } from "./roster";
import { shieldCircleIntersects, shieldSizeMultiplier } from "./shield";
import { shieldCenterX, shieldCenterZ } from "./shieldTilt";
import { SHIELD_TILT_STICK_CAP } from "./stick";
import { advanceFighter } from "./step";
import { advanceSolo, soloWorld } from "./testWorld";

const MARIO_RADIUS = f32(6.799376);
const CARDINALS = [
  { name: "left", action: Action.moveLeft, x: -127, z: 0, shiftX: f32(-3.3000001), shiftZ: 0.0 },
  { name: "right", action: Action.moveRight, x: 127, z: 0, shiftX: 2.75, shiftZ: 0.0 },
  { name: "up", action: Action.moveUp, x: 0, z: 127, shiftX: 0.0, shiftZ: f32(4.400041) },
  { name: "down", action: Action.moveDown, x: 0, z: -127, shiftX: 0.0, shiftZ: f32(-3.6297448) },
] as const;

function guarding(character: Character) {
  const fighter = createFighter(character, 0.0, 1);
  const controls = neutralControls();
  const attacks = attackBuffer(0);
  const row = assertDefined(inputRow({ held: maskOf(Action.rightTrigger), triggerRight: 255 }));
  for (let frame = 0; frame < 8; frame++) {
    adaptInput(row, fighter, frame, controls, attacks);
    advanceSolo(fighter, 0, controls, 0.0);
  }
  assertTrue(fighter.shield.raised);
  return { fighter, controls, attacks };
}

for (const cardinal of CARDINALS) {
  test(`Tilt plus shield gives every fighter capped ${cardinal.name} reach as a fraction of its shield radius without a roll, dodge or jump [k3 measure docs/physics.md]`, () => {
    for (const character of SELECTABLE_CHARACTERS) {
      const { fighter, controls, attacks } = guarding(character);
      const geometry = fighter.tuning.shield;
      const fraction = SHIELD_TILT_STICK_CAP / MARIO_RADIUS;
      const row = assertDefined(inputRow({
        held: maskOf(Action.rightTrigger, Action.walk, cardinal.action), pressed: maskOf(cardinal.action),
        triggerRight: 255, axisX: cardinal.x, axisZ: cardinal.z,
      }));
      adaptInput(row, fighter, 8, controls, attacks);
      assertFalse(controls.groundDodgePressed);
      assertFalse(controls.jumpPressed);
      assertEquals(controls.diStickX, cardinal.x === 0 ? 0.0 : cardinal.x < 0 ? -SHIELD_TILT_STICK_CAP : SHIELD_TILT_STICK_CAP);
      assertEquals(controls.diStickZ, cardinal.z === 0 ? 0.0 : cardinal.z < 0 ? -SHIELD_TILT_STICK_CAP : SHIELD_TILT_STICK_CAP);
      advanceSolo(fighter, 0, controls, 0.0);
      assertTrue(fighter.shield.raised);
      assertTrue(fighter.motion.grounded);
      assertEquals(fighter.jump.squat, 0);
      assertEquals(fighter.dodge.groundFrame, 0);
      assertNear(shieldCenterX(fighter), geometry.centerX + cardinal.shiftX * fraction * geometry.radius, f32(0.001));
      assertNear(shieldCenterZ(fighter), geometry.centerZ + cardinal.shiftZ * fraction * geometry.radius, f32(0.001));
      const pose = projectedShield(fighter, true);
      assertEquals(pose.x, shieldCenterX(fighter));
      assertEquals(pose.z, shieldCenterZ(fighter));
      const restored = createFighter(character, 100.0, -1);
      copyFighterState(restored, fighter, 1);
      assertEquals(projectedShield(restored, true).x, pose.x);
      assertEquals(projectedShield(restored, true).z, pose.z);
    }
  });
}

test("shield tilt moves every fighter's projectile contact circle with its drawn bubble [k3 measure docs/physics.md]", () => {
  const areas = createHitAreaList();
  for (const character of SELECTABLE_CHARACTERS) {
    const { fighter, controls, attacks } = guarding(character);
    const reach = f32(fighter.tuning.shield.radius * shieldSizeMultiplier(fighter.shield.energy, fighter.shield.strength));
    const probe = f32(shieldCenterZ(fighter) + reach + 2.0);
    assertFalse(shieldCircleIntersects(fighter, -1.0, probe, 1.0, probe, 1.0));
    const row = assertDefined(inputRow({ held: maskOf(Action.rightTrigger, Action.walk, Action.moveUp), triggerRight: 255, axisZ: 127 }));
    adaptInput(row, fighter, 8, controls, attacks);
    advanceSolo(fighter, 0, controls, 0.0);
    assertTrue(shieldCircleIntersects(fighter, -1.0, probe, 1.0, probe, 1.0));
    assertEquals(fighter.shield.stun, 0);
    assertEquals(fighter.launch.hitlag, 0);
    for (const strength of [0.0, 1.0]) {
      fighter.shield.strength = strength;
      for (const energy of [SHIELD_MAX, 45.0, f32(SHIELD_MAX / 2), 15.0, 5.0, 0.25]) {
        fighter.shield.energy = energy;
        const pose = projectedShield(fighter, true);
        const label = `${fighterName(character)} energy ${energy} strength ${strength}`;
        assertEquals(pose.x, shieldCenterX(fighter), `${label}: drawn centre x`);
        assertEquals(pose.z, shieldCenterZ(fighter), `${label}: drawn centre z`);
        const collisionRadius = f32(fighter.tuning.shield.radius * shieldSizeMultiplier(energy, strength));
        collectHitAreas(fighter, areas);
        let shieldArea: HitArea | undefined;
        for (let index = 0; index < areas.count; index++) {
          const area = assertDefined(areas.areas[index]);
          if (area.kind === HitAreaKind.shield) {
            shieldArea = area;
            break;
          }
        }
        const shield = assertDefined(shieldArea);
        assertEquals(shield.capsule.x1, shieldCenterX(fighter), `${label}: footprint centre x1`);
        assertEquals(shield.capsule.x2, shieldCenterX(fighter), `${label}: footprint centre x2`);
        assertEquals(shield.capsule.z1, shieldCenterZ(fighter), `${label}: footprint centre z1`);
        assertEquals(shield.capsule.z2, shieldCenterZ(fighter), `${label}: footprint centre z2`);
        assertEquals(shield.capsule.radius, collisionRadius, `${label}: footprint radius`);
        const drawnRadius = f32(pose.scale * 72.0);
        assertEquals(Math.abs(drawnRadius - collisionRadius) <= f32(collisionRadius * f32(0.0000002384185791015625)), true,
          `${label}: drawn radius ${drawnRadius} matches collision radius ${collisionRadius} within binary32 rounding`);
      }
    }
    const world = soloWorld(fighter);
    fighter.shield.energy = SHIELD_MAX;
    fighter.shield.strength = 1.0;
    for (let frame = 9; frame < 600 && fighter.shield.raised; frame++) {
      collectHitAreas(fighter, areas);
      let shieldArea: HitArea | undefined;
      for (let index = 0; index < areas.count; index++) {
        const area = assertDefined(areas.areas[index]);
        if (area.kind === HitAreaKind.shield) {
          shieldArea = area;
          break;
        }
      }
      const shield = assertDefined(shieldArea);
      const label = `${fighterName(character)} drain frame ${frame} energy ${fighter.shield.energy}`;
      assertEquals(shield.capsule.x1, shieldCenterX(fighter), `${label}: footprint centre x1`);
      assertEquals(shield.capsule.x2, shieldCenterX(fighter), `${label}: footprint centre x2`);
      assertEquals(shield.capsule.z1, shieldCenterZ(fighter), `${label}: footprint centre z1`);
      assertEquals(shield.capsule.z2, shieldCenterZ(fighter), `${label}: footprint centre z2`);
      assertEquals(shield.capsule.radius, f32(fighter.tuning.shield.radius * shieldSizeMultiplier(fighter.shield.energy, fighter.shield.strength)), `${label}: footprint radius`);
      adaptInput(row, fighter, frame, controls, attacks);
      advanceFighter(world, 0, 0, controls, 0.0);
    }
    assertFalse(fighter.shield.raised);
    collectHitAreas(fighter, areas);
    let hasShield = false;
    for (let index = 0; index < areas.count; index++) {
      if (assertDefined(areas.areas[index]).kind === HitAreaKind.shield) hasShield = true;
    }
    assertFalse(hasShield);
  }
});
