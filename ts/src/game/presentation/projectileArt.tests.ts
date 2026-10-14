import { mutableProjectile } from "../sim/fighterProjectiles";


import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ProjectileKind } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { ORIGINAL_PROJECTILE_MODELS, fighterProjectileModels, heroProjectileArt, projectileModelOf, restartsStationaryField } from "./projectileArt";
import { heroDefinition } from "../sim/heroes/registry";






const SAME_SPELL: readonly (readonly string[])[] = [];

test("every projectile-firing move names its own stock missile [k3 measure #144]", () => {
  const owner = new Map<string, string>();
  for (const kind of [ProjectileKind.blaster, ProjectileKind.recoil, ProjectileKind.manaBurn] as const) {
    const model = ORIGINAL_PROJECTILE_MODELS[kind];
    assertEquals(owner.get(model), undefined, `kind ${kind} shares ${model}`);
    owner.set(model, `kind ${kind}`);
  }
  let named = 0;
  for (const hero of HERO_ROSTER) {
    if (hero.specials === undefined) continue;
    for (const { slot, spec } of heroProjectileArt(hero.specials)) {
      const move = `${hero.name} ${slot}`;
      assertEquals(spec.model !== undefined, true, `${move} fires a projectile without a model`);
      if (spec.model === undefined) continue;
      const first = owner.get(spec.model);
      const same = first === undefined || first === move || SAME_SPELL.some((group) => group.includes(move) && group.includes(first));
      assertEquals(same, true, `${move} shares ${spec.model} with ${first ?? ""}`);
      owner.set(spec.model, move);
      named++;
    }
  }
  assertTrue(named > 0);
});


test("the Lich's Death and Decay field reseeds its 24-frame emission burst for each strike's whole life, so the field never thins out while it can hit [k3 measure #563]", () => {
  const specials = heroDefinition(Character.lich)?.specials;
  if (specials === undefined) throw new Error("the Lich has specials");
  const fields = heroProjectileArt(specials).flatMap(({ spec }) => spec.model?.includes("DeathAndDecayTarget") === true ? [{ model: spec.model, life: spec.life }] : []);
  assertEquals(fields.length, 2, "both Death and Decay strikes draw the field");
  for (const { model, life } of fields) {
    let since = 0;
    for (let age = 0; age < life; age++) {
      since = restartsStationaryField(model, age, age === 0) ? 0 : since + 1;
      assertEquals(since < 24, true, `the field's emission lapses at age ${age} of ${life}`);
    }
  }
});
