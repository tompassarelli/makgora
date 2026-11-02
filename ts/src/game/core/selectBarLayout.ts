import { f32 } from "wisp/src/sim/f32";
import { BAR_HEIGHT, BAR_STRIP, BAR_TOP, CHAT_SLOT, SELECT_EDGE_LEFT, SELECT_EDGE_RIGHT, STAGE_PREVIEW_BOX } from "./selectScreenLayout";

export interface BarBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type BarPanel = "mode" | "rules" | "guide" | "gear";
export type BarArtStyle = "Frame" | "Lit" | "Primary" | "Panel" | "Key";

const box = (x: number, y: number, width: number, height: number): BarBox => ({ x: f32(x), y: f32(y), width: f32(width), height: f32(height) });
const right = (b: BarBox): number => f32(b.x + b.width);
const bottom = (b: BarBox): number => f32(b.y - b.height);

export const BAR_LEFT = SELECT_EDGE_LEFT;
export const BAR_RIGHT = SELECT_EDGE_RIGHT;
const GAP = f32(0.006);
const CLUSTER_GAP = f32(0.012);
const ATTACHED_GAP = f32(0.002);

const barItem = (x: number, width: number): BarBox => box(x, BAR_TOP, width, BAR_HEIGHT);
const after = (b: BarBox, gap: number, width: number): BarBox => barItem(f32(right(b) + gap), width);
const before = (b: BarBox, gap: number, width: number): BarBox => barItem(f32(f32(b.x - gap) - width), width);

const BACK = barItem(BAR_LEFT, f32(0.07));
const MODE = after(BACK, GAP, f32(0.106));
const TEAMS = after(MODE, ATTACHED_GAP, f32(0.056));
const START = barItem(f32(BAR_RIGHT - f32(0.112)), f32(0.112));
const GEAR = before(START, GAP, f32(0.056));
const GUIDE = before(GEAR, GAP, f32(0.086));
const RULES = barItem(f32(right(TEAMS) + CLUSTER_GAP), f32(f32(GUIDE.x - CLUSTER_GAP) - f32(right(TEAMS) + CLUSTER_GAP)));

/** The one row of the select screen's top bar, left to right. */
export const SELECT_BAR = { back: BACK, mode: MODE, teams: TEAMS, rules: RULES, guide: GUIDE, gear: GEAR, start: START } as const;
export type BarItem = keyof typeof SELECT_BAR;
export const BAR_ORDER: readonly BarItem[] = ["back", "mode", "teams", "rules", "guide", "gear", "start"];

/** Stage select's bar on the same boxes: Back, the Hazards and Orbs toggles, the rules pill, the stage pool across the Guide and gear boxes, and Start. */
export const STAGE_BAR = { back: BACK, hazards: MODE, orbs: TEAMS, rules: RULES, pool: barItem(GUIDE.x, f32(right(GEAR) - GUIDE.x)), start: START } as const;


const KEY_WIDTH = f32(0.022);
const KEY_HEIGHT = f32(0.018);
const KEY_INSET = f32(0.006);
const keyIn = (b: BarBox): BarBox => box(f32(right(b) - KEY_INSET) - KEY_WIDTH, f32(b.y - f32(f32(b.height - KEY_HEIGHT) / 2)), KEY_WIDTH, KEY_HEIGHT);

/** The key badges inside bar items: F1 on Guide, Y on Start. */
export const BAR_KEYS = { guide: keyIn(GUIDE), start: keyIn(START) } as const;

const CHEVRON = f32(0.009);
const chevronLeftOf = (b: BarBox, x: number): BarBox => box(f32(x - CHEVRON), f32(b.y - f32(f32(b.height - CHEVRON) / 2)), CHEVRON, CHEVRON);
/** The small down arrows that mark the items that open a panel. */
export const BAR_CHEVRONS = {
  mode: chevronLeftOf(MODE, f32(right(MODE) - f32(0.008))),
  rules: chevronLeftOf(RULES, f32(right(RULES) - f32(0.01))),
  guide: chevronLeftOf(GUIDE, f32(f32(BAR_KEYS.guide.x) - f32(0.005))),
} as const;
export const GEAR_ICON = box(f32(GEAR.x + f32(0.019)), f32(GEAR.y - f32(0.006)), f32(0.018), f32(0.018));

const PANEL_PAD = f32(0.012);
const ROW = f32(0.028);
const ROW_GAP = f32(0.006);
const PANEL_TOP = f32(bottom(BAR_STRIP) - f32(0.002));

const panelHeight = (heading: number, rows: readonly number[]): number =>
  f32(f32(2 * PANEL_PAD) + heading + rows.reduce((sum, height) => f32(f32(sum + height) + ROW_GAP), 0));

const DRAWER_WIDTH = f32(0.34);
const NOTE_ROW = f32(0.02);
const GEAR_HEIGHTS = [ROW, NOTE_ROW, ROW, ROW];
const MODE_ROW = f32(0.036);
const HEADING = f32(0.02);

/** The panels each bar item opens, under the bar. */
export const BAR_PANELS: Readonly<Record<BarPanel, BarBox>> = {
  rules: box(f32(f32(RULES.x + f32(RULES.width / 2)) - f32(DRAWER_WIDTH / 2)), PANEL_TOP, DRAWER_WIDTH, panelHeight(ROW, [ROW, ROW, ROW, ROW, ROW, ROW])),
  mode: box(MODE.x, PANEL_TOP, f32(0.22), panelHeight(HEADING, [MODE_ROW, MODE_ROW, MODE_ROW, MODE_ROW, ROW, ROW])),
  guide: box(f32(right(GUIDE) - f32(0.2)), PANEL_TOP, f32(0.2), panelHeight(HEADING, [ROW, ROW, ROW])),
  gear: box(f32(right(GEAR) - f32(0.28)), PANEL_TOP, f32(0.28), panelHeight(HEADING, GEAR_HEIGHTS)),
};

const inner = (panel: BarBox) => ({ x: f32(panel.x + PANEL_PAD), width: f32(panel.width - f32(2 * PANEL_PAD)) });
const rowTop = (panel: BarBox, heading: number, index: number, heights: readonly number[]): number => {
  let top = f32(f32(panel.y - PANEL_PAD) - heading);
  for (let row = 0; row < index; row++) top = f32(f32(top - (heights[row] ?? ROW)) - ROW_GAP);
  return top;
};

/** A panel's heading line, above its rows. */
export const panelHeading = (panel: BarPanel): BarBox => {
  const p = BAR_PANELS[panel];
  const { x, width } = inner(p);
  return box(x, f32(p.y - PANEL_PAD), width, panel === "rules" ? ROW : HEADING);
};

const DRAWER = BAR_PANELS.rules;
const DRAWER_INNER = inner(DRAWER);
const drawerRow = (index: number): number => rowTop(DRAWER, f32(ROW + ROW_GAP), index, []);
const half = f32(f32(DRAWER_INNER.width - GAP) / 2);
const third = f32(f32(DRAWER_INNER.width - f32(2 * GAP)) / 3);
const drawerHalf = (index: number, side: 0 | 1): BarBox => box(side === 0 ? DRAWER_INNER.x : f32(f32(DRAWER_INNER.x + half) + GAP), drawerRow(index), half, ROW);
const drawerThird = (index: number, column: 0 | 1 | 2): BarBox => box(f32(DRAWER_INNER.x + f32(column * f32(third + GAP))), drawerRow(index), third, ROW);

const STEP = f32(0.028);
const STEP_VALUE = f32(0.1);
const LABEL_WIDTH = f32(f32(DRAWER_INNER.width - f32(f32(2 * STEP) + STEP_VALUE)) - f32(2 * GAP));
const labelledStep = (index: number) => {
  const y = drawerRow(index);
  const less = box(f32(DRAWER_INNER.x + LABEL_WIDTH) + GAP, y, STEP, ROW);
  const value = box(right(less), y, STEP_VALUE, ROW);
  return { label: box(DRAWER_INNER.x, y, LABEL_WIDTH, ROW), less, value, more: box(right(value), y, STEP, ROW) };
};
const wideStep = (index: number) => {
  const y = drawerRow(index);
  const less = box(DRAWER_INNER.x, y, STEP, ROW);
  const more = box(f32(f32(DRAWER_INNER.x + DRAWER_INNER.width) - STEP), y, STEP, ROW);
  return { less, value: box(right(less), y, f32(more.x - right(less)), ROW), more };
};

/** The rules drawer's rows: Versus presets, stocks, time and four toggles; the item kinds under them while items are on. */
export const DRAWER_ROWS = {
  reset: box(f32(f32(DRAWER_INNER.x + DRAWER_INNER.width) - f32(0.09)), f32(DRAWER.y - PANEL_PAD), f32(0.09), ROW),
  presets: [drawerThird(0, 0), drawerThird(0, 1), drawerThird(0, 2)],
  stocks: labelledStep(1),
  time: labelledStep(2),
  ultimates: drawerHalf(3, 0),
  items: drawerHalf(3, 1),
  endless: drawerHalf(4, 0),
  automaticRematch: drawerHalf(4, 1),
  itemSpeed: drawerHalf(5, 0),
  itemHeavy: drawerHalf(5, 1),
} as const;

/** The drawer's rows in Training: four partner steppers, then hit areas and game speed. */
export const TRAINING_ROWS = {
  behaviour: wideStep(0),
  escape: wideStep(1),
  tech: wideStep(2),
  damage: wideStep(3),
  hitAreas: drawerHalf(4, 0),
  speed: drawerHalf(4, 1),
} as const;

/** The drawer's rows in Classic and Lore Battles: the difficulty or battle, then the route. */
export const CLASSIC_ROWS = {
  tier: wideStep(0),
  route: box(DRAWER_INNER.x, drawerRow(1), DRAWER_INNER.width, f32(f32(4 * ROW) + f32(3 * ROW_GAP))),
} as const;

const MODE_PANEL = BAR_PANELS.mode;
const MODE_INNER = inner(MODE_PANEL);
const MODE_HEIGHTS = [MODE_ROW, MODE_ROW, MODE_ROW, MODE_ROW, ROW, ROW];
const modeRow = (index: number): BarBox => box(MODE_INNER.x, rowTop(MODE_PANEL, f32(HEADING + ROW_GAP), index, MODE_HEIGHTS), MODE_INNER.width, MODE_HEIGHTS[index] ?? ROW);
const TOGGLE_WIDTH = f32(0.072);
const toggleOf = (row: BarBox): BarBox => box(f32(right(row) - TOGGLE_WIDTH), row.y, TOGGLE_WIDTH, row.height);

/** The mode list (one row per mode the game has), then Team Battle and Friendly Fire. */
export const MODE_ROWS = {
  modes: [modeRow(0), modeRow(1), modeRow(2), modeRow(3)],
  teamBattle: modeRow(4),
  teamToggle: toggleOf(modeRow(4)),
  friendlyFire: modeRow(5),
  friendlyToggle: toggleOf(modeRow(5)),
} as const;

const menuRow = (panel: BarPanel, index: number): BarBox => {
  const p = BAR_PANELS[panel];
  const { x, width } = inner(p);
  return box(x, rowTop(p, f32(HEADING + ROW_GAP), index, []), width, ROW);
};

/** The Guide's rows: Controls & Bindings (F1), the move list and the tutorial. */
export const GUIDE_ROWS = { controls: menuRow("guide", 0), moves: menuRow("guide", 1), tutorial: menuRow("guide", 2) } as const;
export const GUIDE_KEY = keyIn(GUIDE_ROWS.controls);

const GEAR_PANEL = BAR_PANELS.gear;
const GEAR_INNER = inner(GEAR_PANEL);
const gearRow = (index: number): BarBox => box(GEAR_INNER.x, rowTop(GEAR_PANEL, f32(HEADING + ROW_GAP), index, GEAR_HEIGHTS), GEAR_INNER.width, GEAR_HEIGHTS[index] ?? ROW);
const delayRow = gearRow(0);
const AUTO_WIDTH = f32(0.056);
const autoDelay = box(f32(right(delayRow) - AUTO_WIDTH), delayRow.y, AUTO_WIDTH, ROW);
const lessDelay = box(delayRow.x, delayRow.y, STEP, ROW);
const moreDelay = box(f32(f32(autoDelay.x - GAP) - STEP), delayRow.y, STEP, ROW);

export const GEAR_ROWS = {
  delay: delayRow,
  stepper: { less: lessDelay, value: box(right(lessDelay), delayRow.y, f32(moreDelay.x - right(lessDelay)), ROW), more: moreDelay },
  auto: autoDelay,
  reason: gearRow(1),
  community: gearRow(2),
  credits: gearRow(3),
} as const;

const HELP_WIDTH = f32(0.4);
const HELP_PAD_X = f32(0.01);
const HELP_PAD_Y = f32(0.008);
const HELP_LINE = f32(0.0135);
const HELP_CHARS_PER_LINE = 56;
export const HELP_MAX_LINES = 4;
const HELP_HEIGHTS = Array.from({ length: HELP_MAX_LINES }, (_, index) => f32(f32(2 * HELP_PAD_Y) + f32((index + 1) * HELP_LINE)));

export function helpBox(text: string): BarBox {
  const lines = Math.min(HELP_MAX_LINES, Math.max(1, Math.ceil(text.length / HELP_CHARS_PER_LINE)));
  return box(0, 0, HELP_WIDTH, HELP_HEIGHTS[lines - 1] ?? HELP_LINE);
}
export const HELP_PADDING = { x: HELP_PAD_X, y: HELP_PAD_Y } as const;
export const helpTooLong = (text: string): boolean => text.length > HELP_MAX_LINES * HELP_CHARS_PER_LINE;

/** Where a rule's hover help sits: under the open panel. */
export const helpAnchor = (panel: BarPanel): BarBox => {
  const p = BAR_PANELS[panel];
  return box(p.x, f32(bottom(p) - f32(0.004)), p.width, 0);
};

export const barBoxContains = (b: BarBox, x: number, y: number): boolean => x >= b.x && x <= right(b) && y <= b.y && y >= bottom(b);

const mils = (value: number): string => `${Math.round(value * 1000)}`;
/** The texture of one framed box: one image per style and size, so its border is never stretched. */
export const barArtName = (style: BarArtStyle, b: { readonly width: number; readonly height: number }): string => `SelectBar${style}${mils(b.width)}x${mils(b.height)}`;
export const barTexture = (style: BarArtStyle, b: { readonly width: number; readonly height: number }): string => `war3mapImported\\${barArtName(style, b)}.tga`;

export interface BarArt {
  readonly style: BarArtStyle;
  readonly width: number;
  readonly height: number;
}

const both = (b: BarBox): BarArt[] => [{ style: "Frame", width: b.width, height: b.height }, { style: "Lit", width: b.width, height: b.height }];

/** Every framed image the select screens' bars, their panels, the chat box and stage select's two boxes draw, for the art build, the map's imports and the preload. */
export function barArt(): readonly BarArt[] {
  const art: BarArt[] = [
    ...[BACK, MODE, TEAMS, RULES, GUIDE, GEAR].flatMap(b => both(b)),
    ...both(START),
    { style: "Primary", width: START.width, height: START.height },
    { style: "Key", width: KEY_WIDTH, height: KEY_HEIGHT },
    ...Object.values(BAR_PANELS).map((p): BarArt => ({ style: "Panel", width: p.width, height: p.height })),
    { style: "Panel", width: CHAT_SLOT.width, height: CHAT_SLOT.height },
    { style: "Panel", width: STAGE_PREVIEW_BOX.width, height: STAGE_PREVIEW_BOX.height },
    ...both(STAGE_BAR.pool),
    ...both(DRAWER_ROWS.reset), ...both(DRAWER_ROWS.presets[0]), ...both(DRAWER_ROWS.stocks.less), ...both(DRAWER_ROWS.ultimates),
    ...both(TRAINING_ROWS.behaviour.value), ...both(DRAWER_ROWS.stocks.value),
    ...both(MODE_ROWS.modes[0]), ...both(MODE_ROWS.teamToggle), ...both(GUIDE_ROWS.controls), ...both(GEAR_ROWS.auto), ...both(GEAR_ROWS.community),...HELP_HEIGHTS.map((height): BarArt => ({ style: "Panel", width: HELP_WIDTH, height })),
  ];
  const seen = new Set<string>();
  return art.filter(item => {
    const name = barArtName(item.style, item);
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

/** The bar's art that is not a framed box: the band, its gold line, the arrows, the gear and the check mark. */
export const BAR_ICONS = ["SelectBarBand", "SelectBarLine", "SelectBarChevron", "SelectBarChevronUp", "SelectBarGear", "SelectBarCheck"] as const;
const icon = (name: (typeof BAR_ICONS)[number]): string => `war3mapImported\\${name}.tga`;
export const BAR_BAND_TEXTURE = icon("SelectBarBand");
export const BAR_LINE_TEXTURE = icon("SelectBarLine");
export const BAR_CHEVRON_TEXTURE = icon("SelectBarChevron");
export const BAR_CHEVRON_UP_TEXTURE = icon("SelectBarChevronUp");
export const BAR_GEAR_TEXTURE = icon("SelectBarGear");
export const BAR_CHECK_TEXTURE = icon("SelectBarCheck");

/** Every image the bar draws, as map imports under war3mapImported. */
export const barArtNames = (): readonly string[] => [...barArt().map(item => barArtName(item.style, item)), ...BAR_ICONS];
