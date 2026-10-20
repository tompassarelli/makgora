import { assertEquals, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { cellRect, rosterGrid, tileAt } from "./selectionGrid";
import { readyChipSize } from "./selectionDrag";

for (const count of [1, 3, 9, 10, 13, 17, 21, 32]) {
  test(`${count} fighters: centered balanced rows with matching pointer targets [k2 property]`, () => {
    const grid = rosterGrid(count);
    const counts: number[] = [];
    let previousTop = -1;
    let row = -1;
    for (let tile = 0; tile < count; tile++) {
      const rect = cellRect(grid, tile);
      if (rect.top !== previousTop) {
        row++;
        counts.push(0);
        previousTop = rect.top;
      }
      counts[row] = (counts[row] ?? 0) + 1;
      assertEquals(tileAt(grid, (rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2), tile);
      assertEquals(rect.left >= f32(0.129) && rect.right <= f32(0.801), true);
      assertEquals(rect.bottom >= f32(0.279) && rect.top <= f32(0.481), true);
      const next = tile + 1 < count ? cellRect(grid, tile + 1) : undefined;
      if (next !== undefined && next.top === rect.top) assertNear(rect.right, next.left, f32(0.000001));
    }
    assertEquals(Math.max(...counts) - Math.min(...counts) <= 1, true);
    let first = 0;
    for (const length of counts) {
      const left = cellRect(grid, first).left;
      const right = cellRect(grid, first + length - 1).right;
      assertNear((left + right) / 2, f32(0.465), f32(0.000001));
      const y = (cellRect(grid, first).top + cellRect(grid, first).bottom) / 2;
      assertEquals(tileAt(grid, left - f32(0.001), y), undefined);
      assertEquals(tileAt(grid, right + f32(0.001), y), undefined);
      first += length;
    }
  });
}

test("ready coin diameter stays 55–70% of tile width across resolution and UI scale [k3 measure #346]", () => {
  const grid = rosterGrid(26);
  for (const height of [720, 1080, 1440]) {
    for (const scale of [f32(0.75), 1.0, f32(1.25)]) {
      const scaled = { ...grid, scale: grid.scale * scale, cellWidth: grid.cellWidth * scale };
      const pixels = height / f32(0.6);
      const diameter = readyChipSize(scaled) * f32(0.92578125) * pixels;
      const width = scaled.cellWidth * pixels;
      assertEquals(diameter >= width * f32(0.55) && diameter <= width * f32(0.7), true);
    }
  }
});
