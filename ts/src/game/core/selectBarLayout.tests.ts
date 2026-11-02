import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { RULE_BUTTONS, type RuleName, rulePanel } from "../ui/ruleButtons";
import { ruleHelp } from "../ui/ruleHelp";
import { createMatchState } from "../lobby/lobbyState";
import {
  BAR_ORDER, BAR_PANELS, type BarArtStyle, type BarBox, type BarPanel, CLASSIC_ROWS, DRAWER_ROWS, GEAR_ROWS, GUIDE_ROWS, MODE_ROWS, SELECT_BAR, TRAINING_ROWS, barArt, barArtName, barBoxContains, HELP_MAX_LINES, helpBox, helpTooLong,
} from "./selectBarLayout";
import { BAR_STRIP } from "./selectScreenLayout";

const right = (b: BarBox): number => f32(b.x + b.width);
const bottom = (b: BarBox): number => f32(b.y - b.height);
const inside = (outer: BarBox, b: BarBox): boolean => b.x >= outer.x && right(b) <= right(outer) && b.y <= outer.y && bottom(b) >= bottom(outer);
const overlaps = (a: BarBox, b: BarBox): boolean => a.x < right(b) && b.x < right(a) && bottom(a) < b.y && bottom(b) < a.y;
const centre = (b: BarBox): readonly [number, number] => [f32(b.x + f32(b.width / 2)), f32(b.y - f32(b.height / 2))];

function apart(boxes: readonly BarBox[]): void {
  boxes.forEach((a, index) => {
    for (const b of boxes.slice(index + 1)) assertFalse(overlaps(a, b));
  });
}

test("The select bar is one row inside the 4:3 area: Back, Mode, Teams, the rules pill, Guide, the gear and Start, one height, left to right, never overlapping, the pill wider than any other item [k2 property]", () => {
  const items = BAR_ORDER.map(key => SELECT_BAR[key]);
  assertEquals(BAR_ORDER.join(" "), "back mode teams rules guide gear start");
  items.forEach((item, index) => {
    assertEquals(item.y, SELECT_BAR.back.y);
    assertEquals(item.height, SELECT_BAR.back.height);
    assertTrue(inside(BAR_STRIP, item));
    const next = items[index + 1];
    if (next !== undefined) assertTrue(right(item) <= next.x);
  });
  assertTrue(SELECT_BAR.back.x >= 0);
  assertTrue(right(SELECT_BAR.start) <= f32(0.8));
  for (const key of BAR_ORDER) if (key !== "rules") assertTrue(SELECT_BAR.rules.width > SELECT_BAR[key].width);
  for (const key of BAR_ORDER) {
    const [x, y] = centre(SELECT_BAR[key]);
    assertEquals(BAR_ORDER.filter(other => barBoxContains(SELECT_BAR[other], x, y)).join(), key);
  }
});

test("Every bar panel opens under the bar inside the screen, and its rows lie inside it without overlapping one another [k2 property]", () => {
  const rows: Readonly<Record<BarPanel, readonly (readonly BarBox[])[]>> = {
    rules: [
      [DRAWER_ROWS.reset, ...DRAWER_ROWS.presets, DRAWER_ROWS.stocks.label, DRAWER_ROWS.stocks.less, DRAWER_ROWS.stocks.value, DRAWER_ROWS.stocks.more,
        DRAWER_ROWS.time.label, DRAWER_ROWS.time.less, DRAWER_ROWS.time.value, DRAWER_ROWS.time.more, DRAWER_ROWS.ultimates, DRAWER_ROWS.items, DRAWER_ROWS.endless, DRAWER_ROWS.automaticRematch,
        DRAWER_ROWS.itemSpeed, DRAWER_ROWS.itemHeavy],
      Object.values(TRAINING_ROWS).flatMap(row => "less" in row ? [row.less, row.value, row.more] : [row]),
      [CLASSIC_ROWS.tier.less, CLASSIC_ROWS.tier.value, CLASSIC_ROWS.tier.more, CLASSIC_ROWS.route],
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

test("Every rule the old top bar showed lives on the bar or in exactly the panel that names it, inside that panel [k2 property]", () => {
  for (const name of Object.keys(RULE_BUTTONS) as RuleName[]) {
    const panel = rulePanel(name);
    const box = RULE_BUTTONS[name];
    if (panel === undefined) assertTrue(BAR_ORDER.some(key => SELECT_BAR[key] === box));
    else {
      assertTrue(inside(BAR_PANELS[panel], box));
      for (const other of ["rules", "mode", "guide", "gear"] as const) if (other !== panel) assertFalse(inside(BAR_PANELS[other], box) && !inside(BAR_PANELS[panel], box));
    }
  }
  assertEquals(rulePanel("fewerStocks"), "rules");
  assertEquals(rulePanel("friendlyFire"), "mode");
  assertEquals(rulePanel("inputDelay"), "gear");
  assertEquals(rulePanel("teamBattle"), undefined);
});

const ITEM_STYLES: readonly BarArtStyle[] = ["Frame", "Lit"];
const START_STYLES: readonly BarArtStyle[] = ["Frame", "Lit", "Primary"];

test("Each framed box has its own art at its own size, one image per style and size [k2 property]", () => {
  const art = barArt();
  const names = art.map(item => barArtName(item.style, item));
  assertEquals(new Set(names).size, names.length);
  const drawn = (style: BarArtStyle, b: BarBox): boolean => art.some(item => item.style === style && item.width === b.width && item.height === b.height && barArtName(item.style, item) === barArtName(style, b));
  for (const key of BAR_ORDER) for (const style of key === "start" ? START_STYLES : ITEM_STYLES) assertTrue(drawn(style, SELECT_BAR[key]));
  for (const panel of ["rules", "mode", "guide", "gear"] as const) assertTrue(drawn("Panel", BAR_PANELS[panel]));
});

test("Every rule's hover help fits its framed panel in at most four lines, in a size the art build makes, as wide as the largest panel's text needs and at least the drawer button text size [k2 property]", () => {
  const sizes = new Set(barArt().filter(item => item.style === "Panel").map(item => barArtName("Panel", item)));
  const game = createMatchState();
  const variants = [game, { ...game, training: true }, { ...game, classic: true }, { ...game, lore: true }];
  for (const variant of variants) {
    for (const name of Object.keys(RULE_BUTTONS) as RuleName[]) {
      const text = ruleHelp(name, variant);
      assertFalse(helpTooLong(text));
      assertTrue(sizes.has(barArtName("Panel", helpBox(text))));
    }
  }
  assertTrue(helpBox("x").width >= f32(0.38));
  assertTrue(helpBox("x".repeat(500)).height <= helpBox("x".repeat(HELP_MAX_LINES * 56)).height);
});

test("The gear's delay row puts − and + around the value with Auto beside them on one line, and the note sits under it above Community [k2 property]", () => {
  const { stepper, auto, reason, community, delay } = GEAR_ROWS;
  assertTrue(right(stepper.less) <= stepper.value.x && right(stepper.value) <= stepper.more.x && right(stepper.more) < auto.x);
  for (const part of [stepper.less, stepper.value, stepper.more, auto]) {
    assertEquals(part.y, delay.y);
    assertTrue(inside(delay, part));
  }
  assertTrue(bottom(delay) >= reason.y && bottom(reason) >= community.y);
});
