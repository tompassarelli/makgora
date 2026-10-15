import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { emptyCapsule, placeCapsule } from "./geometry/contactGeometry";
import { meleeHitIntersectsShield, resolveAttacks } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { fighterPoseFacing } from "./conditions";
import { type Fighter, SHIELD_MAX, createFighter } from "./fighter";
import { heroStrikeMeetsShield } from "./specials/engine";
import { fighterName, SELECTABLE_CHARACTERS } from "./heroes/registry";
import { emptyHitRegion } from "./hitRegions";
import { HurtContact, HurtState, fighterHurtParts, strikeHurtContact } from "./hurtboxes";
import { shieldCircleIntersects, shieldSizeMultiplier } from "./shield";
import { shieldCenterX, shieldCenterZ } from "./shieldTilt";
import { SHIELD_TILT_STICK_CAP } from "./stick";
import { testBeginAttacks, testWorld } from "./testWorld";
import { squareRoot } from "./warcraftMath";

// Full shield down to just above break.
const NEAR_BREAK = 0.25;
const ENERGIES = [SHIELD_MAX, 45.0, 30.0, 15.0, 5.0, NEAR_BREAK] as const;
const STRENGTHS = [0.0, 1.0] as const;
const TILTS = [
  [0.0, 0.0], [SHIELD_TILT_STICK_CAP, 0.0], [-SHIELD_TILT_STICK_CAP, 0.0], [0.0, SHIELD_TILT_STICK_CAP], [0.0, -SHIELD_TILT_STICK_CAP],
] as const;
const SAMPLES = [0.0, 0.25, 0.5, 0.75, 1.0] as const;
const PROBE_RADIUS = 1.0;
const MARGIN = 1.0;

const attacker = createFighter(Character.rifleman, 0.0, 1);
const region = emptyHitRegion();
const strike = { x1: 0.0, z1: 0.0, x2: 0.0, z2: 0.0, radius: 0.0 };
const placed = emptyCapsule();
region.window = 1;
region.strike = strike;

function aim(x1: number, z1: number, x2: number, z2: number, radius: number): void {
  strike.x1 = x1;
  strike.z1 = z1;
  strike.x2 = x2;
  strike.z2 = z2;
  strike.radius = radius;
}

// Resolves one jab whose only strike is the given capsule against a fresh shielding target, through resolveAttacks.
function jabAgainstShield(character: Character, energy: number, x: number, z: number, radius: number): Fighter {
  const jabber = createFighter(Character.rifleman, 0.0, 1);
  const moves = jabber.tuning.moves;
  const jab = moves?.normals[AttackStyle.jab];
  const first = jab?.regions[0];
  if (moves === undefined || jab === undefined || first === undefined) throw new Error("Rifleman has no authored jab");
  const hit = { ...first.hit, effect: { ...first.hit.effect }, strike: { x1: x, z1: z, x2: x, z2: z, radius } };
  jabber.tuning.moves = { ...moves, normals: { ...moves.normals, [AttackStyle.jab]: { ...jab, regions: [{ ...first, hit }] } } };
  const target = createFighter(character, 0.0, -1);
  target.shield.raised = true;
  target.shield.strength = 1.0;
  target.shield.energy = energy;
  const world = testWorld(jabber, target);
  testBeginAttacks(world, AttackStyle.jab, undefined);
  jabber.attack.frame = first.firstFrame;
  resolveAttacks(world);
  return target;
}

// Melee, a hero special and a projectile meet the same bubble for the same capsule; returns their verdict.
function shieldVerdict(target: Fighter, label: string): boolean {
  const melee = meleeHitIntersectsShield(attacker, target, region);
  assertEquals(heroStrikeMeetsShield(attacker, target, region), melee, `${label}: special`);
  assertEquals(shieldCircleIntersects(target, strike.x1, strike.z1, strike.x2, strike.z2, 1.0, strike.radius), melee, `${label}: projectile`);
  return melee;
}

test("a full untilted hard shield centred midway up the standing body is the smallest that contains every standing hurtbox above the floor, and a shrunken shield leaves exposed hurtboxes to melee, specials and projectiles alike while bubble contact stays a shield hit [k2 property]", () => {
  let cases = 0;
  let pokes = 0;
  let covered = 0;
  for (const character of SELECTABLE_CHARACTERS) {
    const target = createFighter(character, 0.0, -1);
    target.shield.raised = true;
    const radius = target.tuning.shield.radius;
    const floor = target.motion.z;
    let exposedNearBreak = 0;
    let pokeX = 0.0;
    let pokeZ = 0.0;
    for (const strength of STRENGTHS) {
      for (const [tiltX, tiltZ] of TILTS) {
        target.shield.strength = strength;
        target.shield.tiltX = tiltX;
        target.shield.tiltZ = tiltZ;
        let farthest = 0.0;
        let top = 0.0;
        let previous = Number.POSITIVE_INFINITY;
        for (const energy of ENERGIES) {
          cases++;
          target.shield.energy = energy;
          const label = `${fighterName(character)} energy ${energy} strength ${strength} tilt ${tiltX},${tiltZ}`;
          const reach = f32(radius * shieldSizeMultiplier(energy, strength));
          assertEquals(reach < previous, true, `${label}: collision radius shrinks with energy`);
          previous = reach;
          const cx = shieldCenterX(target);
          const cz = shieldCenterZ(target);
          aim(cx, f32(cz + reach - 0.5), cx, f32(cz + reach - 0.5), 0.0);
          assertEquals(shieldVerdict(target, `${label} inside rim`), true, `${label}: inside the collision radius meets the shield`);
          aim(f32(cx - reach - 0.5), cz, f32(cx - reach - 0.5), cz, 0.0);
          assertEquals(shieldVerdict(target, `${label} outside rim`), false, `${label}: outside the collision radius misses the shield`);
          const facing = fighterPoseFacing(target);
          for (const part of fighterHurtParts(target)) {
            if ((part.state ?? HurtState.normal) !== HurtState.normal) continue;
            placeCapsule(placed, part, target.motion.x, target.motion.z, facing);
            let px = placed.x1;
            let pz = placed.z1;
            let distance = -1.0;
            for (const t of SAMPLES) {
              const x = f32(placed.x1 + f32(t * f32(placed.x2 - placed.x1)));
              const z = f32(placed.z1 + f32(t * f32(placed.z2 - placed.z1)));
              const d = squareRoot(f32(f32(f32(x - cx) * f32(x - cx)) + f32(f32(z - cz) * f32(z - cz))));
              if (d > distance) {
                distance = d;
                px = x;
                pz = z;
              }
            }
            if (energy === SHIELD_MAX && tiltX === 0.0 && tiltZ === 0.0) {
              for (const [ex, ez] of [[placed.x1, placed.z1], [placed.x2, placed.z2]] as const) {
                const d = squareRoot(f32(f32(f32(ex - cx) * f32(ex - cx)) + f32(f32(ez - cz) * f32(ez - cz))));
                const rx = d === 0.0 ? ex : f32(cx + f32(f32(f32(ex - cx) / d) * f32(d + placed.radius)));
                const rz = d === 0.0 ? f32(ez + placed.radius) : f32(cz + f32(f32(f32(ez - cz) / d) * f32(d + placed.radius)));
                const chord = rz >= floor ? 0.0 : squareRoot(f32(f32(placed.radius * placed.radius) - f32(f32(ez - floor) * f32(ez - floor))));
                for (const [ox, oz] of rz >= floor ? [[rx, rz]] as const : [[f32(ex - chord), floor], [f32(ex + chord), floor]] as const) {
                  const outer = squareRoot(f32(f32(f32(ox - cx) * f32(ox - cx)) + f32(f32(oz - cz) * f32(oz - cz))));
                  assertEquals(outer <= reach, true, `${label}: a full untilted shield contains the standing capsule above the floor`);
                  if (outer > farthest) farthest = outer;
                  aim(ox, oz, ox, oz, 0.0);
                  assertEquals(shieldVerdict(target, `${label} capsule rim`), true, `${label}: the capsule's outer edge above the floor meets a full shield`);
                }
              }
              const capsuleTop = f32(f32((placed.z1 > placed.z2 ? placed.z1 : placed.z2) + placed.radius) - floor);
              if (capsuleTop > top) top = capsuleTop;
              covered++;
            }
            aim(px, pz, cx, cz, PROBE_RADIUS);
            assertEquals(shieldVerdict(target, `${label} through bubble`), true, `${label}: a strike across body and bubble is a shield hit`);
            assertEquals(strikeHurtContact(strike, target), HurtContact.hit, `${label}: the cross strike reaches the body`);
            if (distance <= reach + PROBE_RADIUS + MARGIN) continue;
            pokes++;
            if (energy === NEAR_BREAK && strength === 1.0 && tiltX === 0.0 && tiltZ === 0.0) {
              exposedNearBreak++;
              pokeX = px;
              pokeZ = pz;
            }
            aim(px, pz, px, pz, PROBE_RADIUS);
            assertEquals(strikeHurtContact(strike, target), HurtContact.hit, `${label}: the poke reaches an exposed hurtbox`);
            assertEquals(shieldVerdict(target, `${label} poke`), false, `${label}: a strike only on an exposed hurtbox is a hit`);
          }
        }
        if (strength === 1.0 && tiltX === 0.0 && tiltZ === 0.0) {
          assertEquals(f32(shieldCenterZ(target) - floor), f32(top / 2.0), `${fighterName(character)}: the shield centre is midway from the floor to the top of the standing hurtboxes`);
          assertEquals(f32(f32(radius - 1.0) * shieldSizeMultiplier(SHIELD_MAX, 1.0)) < farthest, true, `${fighterName(character)}: one unit less radius leaves a standing hurtbox outside the full hard shield`);
        }
      }
    }
    const name = fighterName(character);
    assertEquals(exposedNearBreak > 0, true, `${name}: a near-broken shield exposes the body`);
    const poked = jabAgainstShield(character, NEAR_BREAK, pokeX, pokeZ, PROBE_RADIUS);
    assertEquals(poked.status.damage > 0.0, true, `${name}: a jab on the exposed body deals damage`);
    assertEquals(poked.shield.stun, 0, `${name}: a poke is not a shield hit`);
    const blocked = jabAgainstShield(character, SHIELD_MAX, shieldCenterX(poked), shieldCenterZ(poked), PROBE_RADIUS);
    assertEquals(blocked.status.damage, 0.0, `${name}: a jab on the bubble deals no damage`);
    assertEquals(blocked.shield.stun > 0, true, `${name}: a jab on the bubble is a shield hit`);
  }
  assertEquals(cases, SELECTABLE_CHARACTERS.length * STRENGTHS.length * TILTS.length * ENERGIES.length);
  assertTrue(pokes > 0);
  assertTrue(covered >= SELECTABLE_CHARACTERS.length * STRENGTHS.length);
});
