import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, HeroStatusKind } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { duelPair, stepDuel } from "../../sim/testDuel";
import { controls } from "../../sim/testWorld";
import { BASH_STUN, FINGER_LOCK } from "./specials";

const side = controls({ specialPressed: true, specialX: 1, direction: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });
const neutral = controls({ specialPressed: true });
const idle = controls();
const RING = "Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeTarget.mdx";
const PILLAR_COLUMN = "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike.mdx";
const MONSOON = "Abilities\\Spells\\Other\\Monsoon\\MonsoonBoltTarget.mdx";

interface Cast { readonly ring: readonly number[]; readonly column: readonly number[]; readonly damage: number | undefined }

function cast(press: Readonly<ReturnType<typeof controls>>, ringModel: string, columnModel: string, foeX: number): Cast {
  const owner = createFighter(Character.archimonde, 0.0, 1);
  const foe = createFighter(Character.rifleman, foeX, -1);
  const { world } = duelPair(owner, foe);
  const ring: number[] = [], column: number[] = [];
  let damage: number | undefined;
  for (let frame = 1; frame <= 60; frame++) {
    stepDuel(world, frame === 1 ? press : idle);
    for (const projectile of owner.projectiles) if (projectile.life > 0 && Math.abs(projectile.x - foeX) < 1.0) {
      if (projectile.spec?.model === ringModel) ring.push(frame);
      else if (projectile.spec?.model === columnModel) column.push(frame);
    }
    if (damage === undefined && foe.status.damage > 0.0) damage = frame;
  }
  return { ring, column, damage };
}

const PILLAR_X = [170.0, 310.0];

test("Rain of Fire shows a warning ring at each pillar from the cast's start, then its column on the frame the pillar hits [k1 scenario]", () => {
  for (const x of PILLAR_X) {
    const { ring, column, damage } = cast(side, RING, PILLAR_COLUMN, x);
    assertTrue((ring[0] ?? 99) <= 3);
    assertEquals((ring[ring.length - 1] ?? 0) + 1, column[0], "the column replaces the ring with no gap");
    assertEquals(column[0], damage, "the column lands on the pillar's hit frame");
  }
});

test("Finger of Death's lock ring builds from the cast's start and its column lands on the frame it strikes [k1 scenario]", () => {
  const { ring, column, damage } = cast(neutral, FINGER_LOCK.model ?? "", MONSOON, 300.0);
  assertTrue((ring[0] ?? 99) <= 3);
  assertEquals((ring[ring.length - 1] ?? 0) + 1, column[0], "the column replaces the ring with no gap");
  assertEquals(column[0], damage, "the column lands on the strike frame");
});

test("Bash hits a grounded foe twice: the first holds them, the second launches them out, and the hold cannot be chained [k1 scenario]", () => {
  const owner = createFighter(Character.archimonde, 0.0, 1);
  const foe: Fighter = createFighter(Character.rifleman, 60.0, -1);
  const { world } = duelPair(owner, foe);
  const damage: { frame: number; amount: number; held: boolean }[] = [];
  let before = foe.status.damage;
  for (let frame = 1; frame <= 46; frame++) {
    stepDuel(world, frame === 1 ? down : idle);
    if (foe.status.damage !== before) damage.push({ frame, amount: foe.status.damage - before, held: foe.status.condition === HeroStatusKind.stun });
    before = foe.status.damage;
  }
  assertEquals(damage.length, 2);
  assertEquals(damage[0]?.held, true);
  assertEquals(damage[1]?.held, false);
  const total = damage.reduce((sum, hit) => sum + hit.amount, 0);
  assertTrue(Math.abs(total - 12.0) <= f32(0.12));
  assertTrue((foe.status.conditionImmunity[BASH_STUN.group] ?? 0) > 0);
  let held = false;
  for (let frame = 1; frame <= 46; frame++) {
    stepDuel(world, frame === 1 ? down : idle);
    held ||= foe.status.condition === HeroStatusKind.stun;
  }
  assertEquals(held, false, "a second Bash inside the immunity window does not hold again");
});
