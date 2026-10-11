import { expect, test } from "bun:test";
import { SpecialAction } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { AERIAL_DOWN_SETUPS, aerialDownSpecial } from "../scripts/aerialDownSpecials";

test("every fighter's down special pressed rising, falling, near the deck or offstage starts and shows its hitbox or effect before it ends [k1 scenario]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (let setup = 0; setup < AERIAL_DOWN_SETUPS.length; setup++) {
      const row = aerialDownSpecial(character, setup, true);
      const press = `${fighterName(character)} ${AERIAL_DOWN_SETUPS[setup]!.name}`;
      expect([press, row.action !== SpecialAction.none, row.effect > 0]).toEqual([press, true, true]);
    }
  }
});
