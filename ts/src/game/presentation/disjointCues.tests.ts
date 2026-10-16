import { mutableProjectile } from "../sim/fighterProjectiles";
import { assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { createFighter } from "../sim/fighter";
import { Character, ProjectileKind, SpecialAction } from "../sim/codes";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { attackDurationFramesForGrounding } from "../sim/moves";
import { heroProjectileArt } from "./projectileArt";
import { projectedProjectile } from "./projectilePose";
import { disjointNormals, hitAreaPose, specialAreaRegion, type HitAreaPose } from "./disjointCues";
import { specialForm, specialKit } from "../sim/specials/schema";

const pose: HitAreaPose = { visible: false, x: 0.0, z: 0.0, scale: 0.0 };

function farEnd(region: { minX: number; maxX: number; minZ: number; maxZ: number }): [number, number] {
  const x = f32(f32(region.minX + region.maxX) * 0.5), z = f32(f32(region.minZ + region.maxZ) * 0.5);
  if (Math.abs(x) >= Math.abs(f32(z - 66.0))) return [x >= 0.0 ? region.maxX : region.minX, z];
  return [x, z >= 66.0 ? region.maxZ : region.minZ];
}


test("every reach-cued normal flares at each active region's far end every frame in both facings [k2 property]", () => {
  let checked = 0;
  const scratch = emptyHitRegion();
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = createFighter(character, 417.0, 1);
    fighter.motion.z = 193.0;
    const styles = disjointNormals(fighter);
    for (const style of styles) for (const facing of [-1, 1]) {
      fighter.facing = facing;
      fighter.attack.style = style;
      const duration = attackDurationFramesForGrounding(style, true, fighter.tuning.moves);
      for (let frame = 0; frame < duration; frame++) {
        fighter.attack.frame = frame;
        for (let index = 0; index < authoredHitRegionCount(style, fighter.tuning.moves); index++) {
          const region = authoredHitRegion(scratch, character, style, frame, 0, index, fighter.tuning.moves);
          const actual = hitAreaPose(fighter, region, pose);
          assertEquals(actual.visible, region.effect.damage > 0.0);
          if (!actual.visible) continue;
          const [x, z] = farEnd(region);
          assertEquals(actual.x, f32(417.0 + f32(facing * x)));
          assertEquals(actual.z, f32(193.0 + z));
          assertTrue(actual.scale > 0.0);
          checked++;
        }
      }
    }
  }
  assertTrue(checked > 1000);
});

test("every authored special form flares at each live strike's far end on the collision frame [k2 property]", () => {
  let checked = 0;
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = createFighter(character, -321.0, -1);
    const specials = fighter.tuning.specials;
    if (specials === undefined) continue;
    for (const facing of [-1, 1]) for (let slot = 0; slot < 4; slot++) for (let form = 0; form < 7; form++) {
      fighter.facing = facing;
      fighter.special.action = [SpecialAction.heroNeutral, SpecialAction.heroSide, SpecialAction.heroUp, SpecialAction.heroDown][slot] ?? SpecialAction.heroNeutral;
      fighter.special.form = form;
      const move = specialForm(specialKit(specials, slot), form);
      fighter.special.duration = move.endFrame;
      for (let frame = 1; frame <= move.endFrame; frame++) {
        fighter.special.frame = frame;
        for (let index = 0; index < (move.regions?.length ?? 0); index++) {
          const authored = move.regions?.[index];
          if (authored === undefined) continue;
          const active = frame - 1 >= authored.firstFrame && frame - 1 <= authored.lastFrame && authored.hit.effect.damage > 0.0;
          const actual = hitAreaPose(fighter, specialAreaRegion(fighter, index), pose);
          assertEquals(actual.visible, active);
          if (!active) continue;
          const [x, z] = farEnd(authored.hit);
          assertEquals(actual.x, f32(-321.0 + f32(facing * x)));
          assertEquals(actual.z, f32(z));
          checked++;
        }
      }
    }
  }
  assertTrue(checked > 100);
});

test("every hero spell projectile marks its collision centre on every live frame including Lich remote bursts [k2 property]", () => {
  let checked = 0;
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = createFighter(character, 0.0, 1);
    const specials = fighter.tuning.specials;
    const projectile = mutableProjectile(fighter, 0);
    if (specials === undefined || projectile === undefined) continue;
    for (const { spec } of heroProjectileArt(specials)) {
      projectile.kind = ProjectileKind.hero;
      projectile.spec = spec;
      projectile.x = 701.0;
      projectile.z = 227.0;
      projectile.velocityX = spec.velocityX;
      projectile.velocityZ = spec.velocityZ;
      for (let life = spec.life; life > 0; life--) {
        projectile.life = life;
        const actual = projectedProjectile(fighter, 0, true);
        assertTrue(actual.visible);
        assertEquals(actual.x, projectile.x);
        assertEquals(actual.z, projectile.z);
        if (spec.modelRadius !== undefined) {
          assertNear(f32(actual.modelScale * spec.modelRadius), actual.dangerRadius, f32(0.0001));
        }
        checked++;
      }
      projectile.life = 0;
      assertEquals(projectedProjectile(fighter, 0, true).visible, false);
    }
  }
  assertTrue(checked > 1000);
});
