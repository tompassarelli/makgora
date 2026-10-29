import { expect, test } from "bun:test";
import { PLAYABLE_CHARACTERS } from "../src/game/roster/kits";
import { costumesFor } from "../src/game/roster/costumes";
import { PLAYER_COLORS } from "../src/game/ui/slotColors";

type Rgb = readonly [number, number, number];

const linear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const lab = ([red, green, blue]: Rgb): Rgb => {
  const [r, g, b] = [linear(red), linear(green), linear(blue)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const tinted = (base: Rgb, tint: Rgb | undefined): Rgb => tint === undefined ? base : [Math.floor(base[0] * tint[0] / 255), Math.floor(base[1] * tint[1] / 255), Math.floor(base[2] * tint[2] / 255)];

test("no costume tint makes two players' team colours hard to tell apart [k3 measure docs/design/skins.md]", () => {
  const MIN_DELTA_E = 25;
  const slots = PLAYER_COLORS.slice(0, 4).map((color): Rgb => [(color.rgb >> 16) & 255, (color.rgb >> 8) & 255, color.rgb & 255]);
  let worst = Infinity;
  for (const character of PLAYABLE_CHARACTERS) {
    const costumes = costumesFor(character);
    for (const [a, first] of slots.entries()) for (const [b, second] of slots.entries()) {
      if (a === b) continue;
      for (const one of costumes) for (const other of costumes) worst = Math.min(worst, distance(lab(tinted(first, one.tint)), lab(tinted(second, other.tint))));
    }
  }
  console.log(`closest tinted pair of slot colours: ${worst.toFixed(1)} CIE76`);
  expect(worst).toBeGreaterThanOrEqual(MIN_DELTA_E);
});
