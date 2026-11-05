import { assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { RULE_BUTTONS, type RuleName } from "../ui/ruleButtons";
import { ruleHelp } from "../ui/ruleHelp";
import { createMatchState } from "../lobby/lobbyState";
import {
  BAR_PANELS, type BarBox, type BarPanel, ARCADE_ROWS, DRAWER_ROWS, GEAR_ROWS, GUIDE_ROWS, MODE_ROWS, TRAINING_ROWS, barArt, barArtName, HELP_MAX_LINES, helpBox, helpTooLong } from "./selectBarLayout";
import { BAR_STRIP } from "./selectScreenLayout";

const right = (b: BarBox): number => f32(b.x + b.width);
const bottom = (b: BarBox): number => f32(b.y - b.height);
const inside = (outer: BarBox, b: BarBox): boolean => b.x >= outer.x && right(b) <= right(outer) && b.y <= outer.y && bottom(b) >= bottom(outer);
const overlaps = (a: BarBox, b: BarBox): boolean => a.x < right(b) && b.x < right(a) && bottom(a) < b.y && bottom(b) < a.y;

function apart(boxes: readonly BarBox[]): void {
  boxes.forEach((a, index) => {
    for (const b of boxes.slice(index + 1)) assertFalse(overlaps(a, b));
  });
}

test("Every bar panel opens under the bar inside the screen, and its rows lie inside it without overlapping one another [k2 property]", () => {
  const rows: Readonly<Record<BarPanel, readonly (readonly BarBox[])[]>> = {
    rules: [
      [DRAWER_ROWS.reset, ...DRAWER_ROWS.presets, DRAWER_ROWS.stocks.label, DRAWER_ROWS.stocks.less, DRAWER_ROWS.stocks.value, DRAWER_ROWS.stocks.more,
        DRAWER_ROWS.time.label, DRAWER_ROWS.time.less, DRAWER_ROWS.time.value, DRAWER_ROWS.time.more, DRAWER_ROWS.ultimates, DRAWER_ROWS.items, DRAWER_ROWS.endless, DRAWER_ROWS.automaticRematch,
        DRAWER_ROWS.itemSpeed, DRAWER_ROWS.itemHeavy],
      Object.values(TRAINING_ROWS).flatMap(row => "less" in row ? [row.less, row.value, row.more] : [row]),
      [ARCADE_ROWS.tier.less, ARCADE_ROWS.tier.value, ARCADE_ROWS.tier.more, ARCADE_ROWS.guidance, ARCADE_ROWS.route],
    ],
    mode: [[...MODE_ROWS.modes, MODE_ROWS.teamBattle, MODE_ROWS.friendlyFire], [...MODE_ROWS.modes, MODE_ROWS.teamToggle, MODE_ROWS.friendlyToggle]],
    guide: [[GUIDE_ROWS.controls, GUIDE_ROWS.moves, GUIDE_ROWS.tutorial]],
    gear: [[GEAR_ROWS.stepper.less, GEAR_ROWS.stepper.value, GEAR_ROWS.stepper.more, GEAR_ROWS.auto, GEAR_ROWS.reason, GEAR_ROWS.community, GEAR_ROWS.credits], [GEAR_ROWS.delay, GEAR_ROWS.reason, GEAR_ROWS.community, GEAR_ROWS.credits]],
  };
  for (const panel of ["rules", "mode", "guide", "gear"] as const) {
    const box = BAR_PANELS[panel];
    assertTrue(box.x >= 0 && right(box) <= f32(0.8) && bottom(box) >= 0);
    assertTrue(box.y <= bottom(BAR_STRIP));
    for (const layer of rows[panel]) {
      for (const row of layer) assertTrue(inside(box, row));
      apart(layer);
    }
  }
});

test("Every rule's hover help fits its framed panel in at most four lines, in a size the art build makes, as wide as the largest panel's text needs and at least the drawer button text size [k2 property]", () => {
  const sizes = new Set(barArt().filter(item => item.style === "Panel").map(item => barArtName("Panel", item)));
  const game = createMatchState();
  const variants = [game, { ...game, training: true }, { ...game, arcade: true }];
  for (const variant of variants) {
    for (const name of Object.keys(RULE_BUTTONS) as RuleName[]) {
      for (const offline of [1, 2]) {
        const text = ruleHelp(name, variant, offline);
        assertFalse(helpTooLong(text));
        assertTrue(sizes.has(barArtName("Panel", helpBox(text))));
      }
    }
  }
  assertTrue(helpBox("x").width >= f32(0.38));
  assertTrue(helpBox("x".repeat(500)).height <= helpBox("x".repeat(HELP_MAX_LINES * 56)).height);
});
