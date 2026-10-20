import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { beginFighterAttack, resolveAttacks } from "./attacks";
import { AttackStyle, Character, ProjectileKind } from "./codes";
import { createFighter } from "./fighter";
import { attackStartupFrames } from "./moves";
import { spawnProjectileMotion, updateProjectiles } from "./projectiles";
import { createRoster, fighterAt } from "./roster";
import { advanceFreezeTraps } from "./summons";
import { mutableFreezeTrap } from "./fighterRest";

function squad(teamBattle: boolean, friendlyFire: boolean) {
  const world = createRoster(7, [createFighter(Character.rifleman, 0.0, 1), createFighter(Character.rifleman, 0.0, -1), createFighter(Character.rifleman, 0.0, -1)]);
  world.teamBattle = teamBattle; world.friendlyFire = friendlyFire;
  world.teamChoices[0] = 0; world.teamChoices[1] = 0; world.teamChoices[2] = 1;
  for (const fighter of world.fighters) if (fighter !== undefined) { fighter.motion.grounded = true; fighter.motion.surface = 0; }
  return world;
}

test("team hit eligibility preserves enemies and free for all across melee grabs crossing shots and frost traps with friendly fire on or off [k2 property]", () => {
  for (const teamBattle of [false, true]) for (const friendlyFire of [false, true]) {
    const alliesCanHit = !teamBattle || friendlyFire;
    const melee = squad(teamBattle, friendlyFire);
    const attacker = fighterAt(melee, 0);
    beginFighterAttack(melee, 0, AttackStyle.jab, false);
    attacker.attack.frame = attackStartupFrames(AttackStyle.jab, attacker.tuning.moves);
    resolveAttacks(melee);
    assertEquals(fighterAt(melee, 1).status.damage > 0.0, alliesCanHit);
    assertTrue(fighterAt(melee, 2).status.damage > 0.0);
    const grabbing = squad(teamBattle, friendlyFire);
    const grabber = fighterAt(grabbing, 0);
    beginFighterAttack(grabbing, 0, AttackStyle.grab, false);
    grabber.attack.frame = attackStartupFrames(AttackStyle.grab, grabber.tuning.moves);
    resolveAttacks(grabbing);
    assertEquals(grabber.grab.target, alliesCanHit ? 1 : 2);
    const shots = squad(teamBattle, friendlyFire);
    fighterAt(shots, 1).motion.x = 50.0; fighterAt(shots, 2).motion.x = 100.0;
    const projectile = spawnProjectileMotion(fighterAt(shots, 0), ProjectileKind.blaster, 200.0, 0.0, 3, 1);
    if (projectile === undefined) throw new Error("team shot was not created");
    projectile.x = -10.0; projectile.z = 45.0;
    updateProjectiles(shots);
    assertEquals(fighterAt(shots, 1).status.damage > 0.0, alliesCanHit);
    assertEquals(fighterAt(shots, 2).status.damage > 0.0, !alliesCanHit);
    const traps = squad(teamBattle, friendlyFire);
    const trap = mutableFreezeTrap(fighterAt(traps, 0));
    trap.life = 30; trap.x = 0.0; trap.surface = 0;
    advanceFreezeTraps(traps, 0, 0);
    assertEquals(fighterAt(traps, 1).status.frozenFrames > 0, alliesCanHit);
    assertEquals(fighterAt(traps, 2).status.frozenFrames > 0, !alliesCanHit);
  }
});
