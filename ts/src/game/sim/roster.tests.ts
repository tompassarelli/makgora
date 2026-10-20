import { assertEquals, test } from "wisp/src/runtime/testing";
import { createRoster, isActive, setRosterMask } from "./roster";

const oldActive = (mask: number, slot: number): boolean => mask > 0 && mask < 16 && slot >= 0 && slot < 4 && (mask & (1 << slot)) !== 0;

test("a roster's active slots follow its mask for every mask from -8 to 255 and every slot from -1 to 4, set at creation or after [k2 property]", () => {
  const roster = createRoster(0);
  let checked = 0;
  for (let mask = -8; mask < 256; mask++) {
    const created = createRoster(mask);
    setRosterMask(roster, mask);
    for (let slot = -1; slot <= 4; slot++) {
      assertEquals(isActive(created, slot), oldActive(mask, slot), `created mask ${mask} slot ${slot}`);
      assertEquals(isActive(roster, slot), oldActive(mask, slot), `set mask ${mask} slot ${slot}`);
      checked++;
    }
    assertEquals(roster.mask, mask);
  }
  assertEquals(checked, 264 * 6);
});
