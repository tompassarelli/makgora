import { assertEquals, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, LedgeState } from "./codes";
import { createReferenceFighter } from "./referenceRig";
import { beginFighterAttack, resolveAttacks } from "./attacks";
import { attackDamage, attackStartupFrames } from "./moves";
import { createRoster } from "./roster";
import { controls } from "./testWorld";
import { resolveLedges } from "./ledge";
import { idiv, imod } from "wisp/src/sim/intMath";

function fourWorld() {
  return createRoster(15, [
    createReferenceFighter(Character.sylvanas, -300.0, 1),
    createReferenceFighter(Character.sylvanas, -100.0, -1),
    createReferenceFighter(Character.sylvanas, 100.0, 1),
    createReferenceFighter(Character.sylvanas, 300.0, -1),
  ]);
}

test("one victim hit by two attackers on the same frame takes both hits, and takes no further damage on the next resolve [k3 measure #12]", () => {
  const world = fourWorld();
  world.fighters[0]!.motion.x = 0.0;
  world.fighters[2]!.motion.x = 0.0;
  world.fighters[3]!.motion.x = 100.0;
  for (const slot of [0, 2]) {
    beginFighterAttack(world, slot, AttackStyle.jab, false);
    world.fighters[slot]!.attack.frame = attackStartupFrames(AttackStyle.jab);
  }
  resolveAttacks(world);
  assertEquals(world.fighters[3]!.status.damage, attackDamage(AttackStyle.jab) * 2);
  world.fighters[0]!.launch.hitlag = 0;
  world.fighters[2]!.launch.hitlag = 0;
  resolveAttacks(world);
  assertEquals(world.fighters[3]!.status.damage, attackDamage(AttackStyle.jab) * 2);
});

const LEDGE_PLACES = [-630.0, -620.0, 620.0, 630.0];

test("four fighters falling past both ledges: at each ledge the nearer catches, for every assignment of slots to places [k2 property]", () => {
  for (let order = 0; order < 24; order++) {
    const free = [0, 1, 2, 3];
    const placeOf: number[] = [];
    let rest = order;
    for (let count = 4; count > 0; count--) {
      placeOf.push(free.splice(imod(rest, count), 1)[0]!);
      rest = idiv(rest, count);
    }
    const world = fourWorld();
    for (let slot = 0; slot < 4; slot++) {
      const fighter = world.fighters[slot]!;
      const x = LEDGE_PLACES[placeOf[slot]!]!;
      const side = x < 0.0 ? -1 : 1;
      fighter.motion.x = x;
      fighter.motion.z = -80.0;
      fighter.motion.vz = -2.0;
      fighter.motion.deltaZ = -2.0;
      fighter.motion.grounded = false;
      fighter.facing = -side;
    }
    resolveLedges(world, 0, [controls(), controls(), controls(), controls()]);
    for (let slot = 0; slot < 4; slot++) {
      const nearer = placeOf[slot] === 1 || placeOf[slot] === 2;
      assertEquals(world.fighters[slot]!.ledge.state, nearer ? LedgeState.hang : LedgeState.none, `order ${order} slot ${slot}`);
    }
  }
});
