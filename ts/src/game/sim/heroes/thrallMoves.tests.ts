import { assertEquals, assertLessThan, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack } from "../attacks";
import { AttackStyle, Character } from "../codes";
import { type Fighter, createFighter } from "../fighter";
import { duelPair, stepDuel } from "../testDuel";

interface Contact { readonly frame: number; readonly damage: number; readonly behind: boolean }

function airborne(fighter: Fighter, z: number): void {
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  fighter.motion.z = z;
  fighter.jump.remaining = 1;
}

function backAirContacts(): Contact[] {
  const thrall = createFighter(Character.thrall, 0.0, 1);
  const target = createFighter(Character.thrall, -110.0, 1);
  airborne(thrall, 300.0);
  airborne(target, 300.0);
  const { world } = duelPair(thrall, target, 0);
  beginFighterAttack(world, 0, AttackStyle.backAir, false);
  assertEquals(thrall.attack.style, AttackStyle.backAir);
  const contacts: Contact[] = [];
  let hits = target.visuals.hit, damage = target.status.damage;
  for (let step = 1; step <= 40 && contacts.length < 3; step++) {
    stepDuel(world);
    if (target.visuals.hit !== hits) contacts.push({ frame: thrall.attack.frame + 1, damage: f32(target.status.damage - damage), behind: target.motion.x < thrall.motion.x });
    hits = target.visuals.hit;
    damage = target.status.damage;
  }
  return contacts;
}

test("Thrall's back air kicks a foe behind him with the wolf on frame 8 for 6.144%, then the hammer strikes behind on frame 17 for 12.288% [k1 scenario]", () => {
  const contacts = backAirContacts();
  assertEquals(contacts.map(contact => `${contact.frame}:${contact.behind}`).join(" "), "8:true 17:true");
  assertNear(contacts[0]!.damage, 6.144000053405762, f32(0.001));
  assertNear(contacts[1]!.damage, 12.288000106811523, f32(0.001));
  const move = createFighter(Character.thrall, 0.0, 1).tuning.moves!.normals[AttackStyle.backAir]!;
  assertEquals(move.totalFrames, 43);
  for (const region of move.regions) assertLessThan(region.hit.maxX, 0.0);
});
