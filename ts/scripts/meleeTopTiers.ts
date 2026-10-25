import { join } from "node:path";
import {
  ATTRIBUTES, FIGHTCORE, type Fighter, fighters, firstNumber, LIBMELEE, loadReference, RECORDS, ROOT, TOP_EIGHT,
} from "./meleeReferenceData";
import { type FighterTaste, type MeasureKey, PATTERNS, TASTE } from "./meleeTopTierTaste";

const PAGE = "docs/design/melee/top-tiers.md";
const VICTIM_WEIGHT = 100;
const OWN_AERIAL_JUMP = new Set(["jigglypuff", "kirby", "mewtwo", "ness", "peach", "yoshi"]);

type Value = (f: Fighter) => number | null;
interface Row { readonly label: string; readonly value: Value }
interface Measure {
  readonly title: string;
  readonly source: string;
  readonly order: "smallest" | "largest";
  readonly digits: number;
  readonly rows: readonly Row[];
}
interface Section { readonly title: string; readonly note?: string; readonly rowName?: string; readonly measures: readonly Measure[] }

const ref = await loadReference();
const roster = fighters();
const top = roster.filter((f) => TOP_EIGHT.includes(f.id)).sort((a, b) => TOP_EIGHT.indexOf(a.id) - TOP_EIGHT.indexOf(b.id));

const attack = (action: string, key: string): Value => (f) => ref.field(f, "attacks", action, key);
const actionable = (f: Fighter, category: string, action: string): number | null => {
  const iasa = ref.field(f, category, action, "iasa"), total = ref.field(f, category, action, "total");
  return iasa ?? (total === null ? null : total + 1);
};
const activeSpan = (category: string, action: string): Value => (f) => {
  const start = ref.field(f, category, action, "start"), end = ref.field(f, category, action, "end");
  return start === null || end === null ? null : end - start + 1;
};
const endLag = (category: string, action: string): Value => (f) => {
  const end = ref.field(f, category, action, "end"), ready = actionable(f, category, action);
  return end === null || ready === null ? null : ready - end - 1;
};

function knockback(move: string, prePercent: number): Value {
  return (f) => {
    const damage = firstNumber(ref.fightcore(f, move, "Damage"));
    const growth = firstNumber(ref.fightcore(f, move, "Knockback Growth"));
    if (damage === null || growth === null) return null;
    const base = firstNumber(ref.fightcore(f, move, "Base Knockback")) ?? 0;
    const set = firstNumber(ref.fightcore(f, move, "Set Knockback"));
    const d = Math.trunc(set ?? damage), p = set === null ? prePercent + Math.trunc(damage) : 10;
    return ((p / 10 + (p * d) / 20) * (200 / (VICTIM_WEIGHT + 100)) * 1.4 + 18) * (growth / 100) + base;
  };
}

const attribute = (column: string): Value => (f) => firstNumber(ref.attribute(f, column));

function aerialJumpHeight(f: Fighter): number | null {
  if (OWN_AERIAL_JUMP.has(f.id)) return null;
  const jump = firstNumber(ref.attribute(f, "Jump V Initial Velocity")), multiplier = firstNumber(ref.attribute(f, "Air Jump Multiplier B (16)"));
  const gravity = firstNumber(ref.attribute(f, "Gravity")), count = Number.parseInt(ref.attribute(f, "Number of Jumps") ?? "", 16);
  if (jump === null || multiplier === null || gravity === null || Number.isNaN(count)) return null;
  const v = jump * multiplier, frames = Math.floor(v / gravity);
  return (frames * v - (gravity * frames * (frames + 1)) / 2) * (count - 1);
}

function grabRange(f: Fighter): number | null {
  const hitboxes = ref.hitboxes(f, "standing_grab");
  return hitboxes.length === 0 ? null : Math.max(...hitboxes.map((h) => h.x + h.size));
}

const AERIALS = ["nair", "fair", "bair", "uair", "dair"];
interface Option { readonly label: string; readonly frame: number | null }
function outOfShieldOptions(f: Fighter): Option[] {
  const squat = firstNumber(ref.attribute(f, "JumpSquat Frames"));
  const plus = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);
  const aerial = Math.min(...AERIALS.map((a) => ref.field(f, "attacks", a, "start") ?? Infinity));
  return [
    { label: "grab", frame: ref.field(f, "grabs", "standing_grab", "start") },
    { label: "up smash", frame: plus(1, ref.field(f, "attacks", "usmash", "start")) },
    { label: "up special", frame: ref.field(f, "attacks", "up_b", "start") },
    { label: "aerial", frame: plus(squat, Number.isFinite(aerial) ? aerial : null) },
    { label: "down special", frame: plus(squat, ref.field(f, "attacks", "down_b", "start")) },
  ];
}
const outOfShield: Value = (f) => {
  const frames = outOfShieldOptions(f).flatMap((o) => (o.frame === null ? [] : [o.frame]));
  return frames.length === 0 ? null : Math.min(...frames);
};

interface Move { readonly label: string; readonly action: string; readonly fightcore: string }
const move = (label: string, action: string, fightcore: string): Move => ({ label, action, fightcore });
const JAB = [move("Jab 1", "jab1", "Jab 1")];
const TILTS = [move("Forward tilt", "ftilt", "Forward Tilt"), move("Up tilt", "utilt", "Up Tilt"), move("Down tilt", "dtilt", "Down Tilt")];
const SMASHES = [move("Forward smash", "fsmash", "Forward Smash"), move("Up smash", "usmash", "Up Smash"), move("Down smash", "dsmash", "Down Smash")];
const AERIAL_MOVES = [
  move("Neutral air", "nair", "Neutral Air"), move("Forward air", "fair", "Forward Air"), move("Back air", "bair", "Back Air"),
  move("Up air", "uair", "Up Air"), move("Down air", "dair", "Down Air"),
];
const SPECIALS = [move("Neutral special", "neutral_b", ""), move("Side special", "side_b", ""), move("Up special", "up_b", ""), move("Down special", "down_b", "")];
const GRABS = [move("Standing grab", "standing_grab", "Grab"), move("Dash grab", "dash_grab", "Dashgrab")];
const THROWS = [
  move("Forward throw", "forward_throw", "Forward throw"), move("Back throw", "back_throw", "Back throw"),
  move("Up throw", "up_throw", "Up throw"), move("Down throw", "down_throw", "Down throw"),
];

const recordSource = (category: string, fields: string) => `\`${RECORDS}\`, \`${category}\` records, ${fields}`;
const rows = (moves: readonly Move[], value: (m: Move) => Value): Row[] => moves.map((m) => ({ label: m.label, value: value(m) }));

function frameMeasures(moves: readonly Move[], category: string): Measure[] {
  return [
    { title: "Startup", order: "smallest", digits: 0, rows: rows(moves, (m) => (f) => ref.field(f, category, m.action, "start")),
      source: `${recordSource(category, "field `start`")}: the first active frame, counting from 1.` },
    { title: "Active span", order: "largest", digits: 0, rows: rows(moves, (m) => activeSpan(category, m.action)),
      source: `${recordSource(category, "fields `start` and `end`")}: \`end − start + 1\`, first to last active frame, gaps between hits included.` },
    { title: "End lag after the last active frame", order: "smallest", digits: 0, rows: rows(moves, (m) => endLag(category, m.action)),
      source: `${recordSource(category, "fields `end`, `iasa` and `total`")}: frames after \`end\` before the first actionable frame, \`iasa\`, or \`total + 1\` where \`iasa\` is empty.` },
  ];
}

const shieldstun = (moves: readonly Move[]): Measure => ({
  title: "Shieldstun", order: "largest", digits: 0, rows: rows(moves, (m) => attack(m.action, "stun")),
  source: `${recordSource("attacks", "field `stun`")}: shieldstun frames on the defender.`,
});

function knockbackMeasures(moves: readonly Move[]): Measure[] {
  const source = (percent: number) => `\`${FIGHTCORE}\`, columns \`Damage\`, \`Base Knockback\`, \`Knockback Growth\` and \`Set Knockback\`, first (strongest) hitbox: `
    + `SmashWiki's Knockback formula ((p/10 + p·d/20)·200/(w+100)·1.4 + 18)·g/100 + b with victim weight w = ${VICTIM_WEIGHT}, `
    + `p = ${percent} + d before the hit (p = 10 and d = set knockback for set-knockback hitboxes), fresh, no crouch or charge.`;
  return [0, 100].map((percent) => ({
    title: `Knockback at ${percent}%`, order: "largest", digits: 1, rows: rows(moves, (m) => knockback(m.fightcore, percent)), source: source(percent),
  }));
}

const groundSection = (title: string, moves: readonly Move[]): Section => ({
  title, measures: [...frameMeasures(moves, "attacks"), shieldstun(moves), ...knockbackMeasures(moves)],
});

const LANDING: Measure[] = [
  { title: "Landing lag", order: "smallest", digits: 0, rows: rows(AERIAL_MOVES, (m) => attack(m.action, "land_lag")),
    source: `${recordSource("attacks", "field `land_lag`")}: frames of lag on landing during the aerial.` },
  { title: "L-cancelled landing lag", order: "smallest", digits: 0, rows: rows(AERIAL_MOVES, (m) => attack(m.action, "cancel_lag")),
    source: `${recordSource("attacks", "field `cancel_lag`")}.` },
];

const attributeMeasure = (title: string, column: string, order: Measure["order"], digits: number, note: string): Measure => ({
  title, order, digits, rows: [{ label: title, value: attribute(column) }],
  source: `\`${ATTRIBUTES}\`, column \`${column}\`${note}.`,
});

const ATTRIBUTE_MEASURES: Measure[] = [
  attributeMeasure("Initial dash speed", "Dash Initial Velocity", "largest", 2, ", Melee units per frame"),
  attributeMeasure("Run speed", "Dash & Run Terminal Velocity", "largest", 2, ", Melee units per frame"),
  attributeMeasure("Air speed", "Air Speed", "largest", 2, ", Melee units per frame; the first value where the cell holds two"),
  attributeMeasure("Fall speed", "Terminal Velocity", "largest", 2, ", Melee units per frame"),
  attributeMeasure("Fast-fall speed", "Fast Fall Terminal Velocity", "largest", 2, ", Melee units per frame"),
  attributeMeasure("Jump squat", "JumpSquat Frames", "smallest", 0, ", frames"),
  attributeMeasure("Weight", "Weight", "largest", 0, "; the first value where the cell holds two"),
  { title: "Fastest out-of-shield option", order: "smallest", digits: 0, rows: [{ label: "Fastest option", value: outOfShield }],
    source: `\`${RECORDS}\` fields \`start\` of \`grabs\` standing_grab and \`attacks\` usmash, up_b, the five aerials and down_b, with \`${ATTRIBUTES}\` column \`JumpSquat Frames\`: `
      + "the earliest first-active frame of a shield grab, an up smash cancelling the jump squat (start + 1), an up special, or an aerial or down special after the jump squat (squat + start). "
      + "Each fighter's option is named below the table." },
  { title: "Grab range", order: "largest", digits: 1, rows: [{ label: "Standing grab", value: grabRange }],
    source: `\`${LIBMELEE}\`, action \`standing_grab\`, \`hitbox_frames\` fields \`x\` and \`size\`: the farthest \`x + size\` ahead of the fighter on any active frame, Melee units.` },
  { title: "Recovery distance from aerial jumps", order: "largest", digits: 1, rows: [{ label: "Aerial jump height × aerial jumps", value: aerialJumpHeight }],
    source: `\`${ATTRIBUTES}\`, columns \`Jump V Initial Velocity\`, \`Air Jump Multiplier B (16)\`, \`Gravity\` and \`Number of Jumps\`: `
      + "the summed per-frame rise of one aerial jump at velocity v = jump velocity × multiplier, n = ⌊v/g⌋ frames, n·v − g·n(n+1)/2, times the aerial jumps (jumps − 1), Melee units. "
      + "Up-special travel is not in the four sources. Jigglypuff, Kirby, Mewtwo, Ness, Peach and Yoshi have their own animated aerial jumps, so the formula does not apply to them and their cells are empty." },
];

const SECTIONS: Section[] = [
  groundSection("Jab", JAB),
  groundSection("Tilts", TILTS),
  groundSection("Smashes", SMASHES),
  { title: "Aerials", measures: [...frameMeasures(AERIAL_MOVES, "attacks"), ...LANDING, shieldstun(AERIAL_MOVES), ...knockbackMeasures(AERIAL_MOVES)] },
  { title: "Specials", measures: [...frameMeasures(SPECIALS, "attacks"), shieldstun(SPECIALS)],
    note: "Grounded versions. Knockback is left out because FightCore names specials per fighter rather than by input, so its rows have no common slot to compare." },
  { title: "Grabs", measures: [
    frameMeasures(GRABS, "grabs")[0] as Measure,
    { title: "Total frames", order: "smallest", digits: 0, rows: rows(GRABS, (m) => (f) => ref.field(f, "grabs", m.action, "total")),
      source: `${recordSource("grabs", "field `total`")}: the whiffed grab's length.` },
  ] },
  { title: "Throws", measures: [...frameMeasures(THROWS, "throws"), ...knockbackMeasures(THROWS)],
    note: "meleeframedata.com times throws on Mario." },
  { title: "Attributes", rowName: "Measure", measures: ATTRIBUTE_MEASURES },
];

const format = (digits: number) => (v: number): string => v.toFixed(digits).replace(/^-/, "−");

function rank(values: readonly (number | null)[], order: Measure["order"]): (string | null)[] {
  const sign = order === "smallest" ? 1 : -1;
  return values.map((v) => {
    if (v === null) return null;
    const better = values.filter((w) => w !== null && sign * (w - v) < 0).length;
    const tied = values.filter((w) => w === v).length > 1;
    return `${better + 1}${tied ? "=" : ""}`;
  });
}

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b), mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

function summary(values: readonly number[], fmt: (v: number) => string): string {
  if (values.length === 0) return "–";
  return `${fmt(median(values))} (${fmt(Math.min(...values))}–${fmt(Math.max(...values))})`;
}

function tableRow(row: Row, measure: Measure): string[] {
  const fmt = format(measure.digits);
  const values = roster.map(row.value), ranks = rank(values, measure.order);
  const pick = (inTop: boolean) => values.filter((v, i): v is number => v !== null && TOP_EIGHT.includes(roster[i]?.id ?? "") === inTop);
  const cells = top.map((f) => {
    const i = roster.indexOf(f), v = values[i] ?? null;
    return v === null ? "–" : `${fmt(v)} (#${ranks[i] ?? ""})`;
  });
  return [row.label, String(values.filter((v) => v !== null).length), summary(pick(true), fmt), summary(pick(false), fmt), ...cells];
}

function markdownTable(header: readonly string[], body: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]) => `| ${cells.join(" | ")} |`;
  return [line(header), line(header.map((_, i) => (i === 0 ? "---" : "---:"))), ...body.map(line)].join("\n");
}

function renderMeasure(measure: Measure, rowName: string): string {
  const header = [rowName, "Fighters", "Top eight: median (range)", "Other eighteen: median (range)", ...top.map((f) => f.name)];
  const rankNote = `Rank 1 is the ${measure.order} value.`;
  return [`### ${measure.title}`, "", `Source: ${measure.source} ${rankNote}`, "", markdownTable(header, measure.rows.map((r) => tableRow(r, measure)))].join("\n");
}

function outOfShieldTable(): string {
  return markdownTable(["Fighter", "Fastest option", "Frame"], roster.map((f) => {
    const options = outOfShieldOptions(f), best = outOfShield(f);
    const names = options.filter((o) => o.frame !== null && o.frame === best).map((o) => o.label);
    return [TOP_EIGHT.includes(f.id) ? `**${f.name}**` : f.name, names.join(", ") || "–", best === null ? "–" : String(best)];
  }));
}

function renderSection(section: Section): string {
  const parts = [`## ${section.title}`];
  if (section.note !== undefined) parts.push(section.note);
  for (const measure of section.measures) {
    parts.push(renderMeasure(measure, section.rowName ?? "Move"));
    if (measure.rows[0]?.value === outOfShield) parts.push(outOfShieldTable());
  }
  return parts.join("\n\n");
}

const lowerFirst = (s: string): string => (s.charAt(1) === "-" ? s : s.charAt(0).toLowerCase() + s.slice(1));

interface Located { readonly measure: Measure; readonly row: Row; readonly phrase: string }
function locate(key: MeasureKey): Located {
  const measure = SECTIONS.find((s) => s.title === key.section)?.measures.find((m) => m.title === key.measure);
  const row = key.row === undefined ? measure?.rows[0] : measure?.rows.find((r) => r.label === key.row);
  if (measure === undefined || row === undefined) throw new Error(`no measure ${key.section} / ${key.measure} / ${key.row ?? "first row"}`);
  const phrase = key.row === undefined ? lowerFirst(measure.title) : `${lowerFirst(key.row)} ${lowerFirst(measure.title)}`;
  return { measure, row, phrase };
}

function standing(key: MeasureKey, f: Fighter): string {
  const { measure, row, phrase } = locate(key);
  const values = roster.map(row.value), i = roster.indexOf(f), v = values[i] ?? null;
  if (v === null) throw new Error(`${f.name} has no value for ${phrase}`);
  const count = values.filter((w) => w !== null).length;
  return `${phrase} ${format(measure.digits)(v)}, rank ${rank(values, measure.order)[i] ?? ""} of ${count}`;
}

function handWritten(text: string): string {
  if (/\d/.test(text)) throw new Error(`hand-written prose quotes a number; let the generator render it: ${text}`);
  return text;
}

function renderTaste(taste: FighterTaste): string {
  const f = top.find((t) => t.id === taste.id);
  if (f === undefined) throw new Error(`${taste.id} is not in the top eight`);
  const traits = taste.traits.map((t) => `- **${handWritten(t.name)}** (${standing(t.measure, f)}): ${handWritten(t.why)}`);
  const sources = taste.sources.map((s) => `[${s.title}](${s.url})`).join(", ");
  return [`### ${f.name}`, handWritten(taste.summary), traits.join("\n"), `Rationale: ${sources}.`].join("\n\n");
}

function renderPattern(pattern: (typeof PATTERNS)[number]): string {
  const { measure, row, phrase } = locate(pattern.measure);
  const fmt = format(measure.digits);
  const values = roster.map((f) => ({ f, v: row.value(f) }));
  const pick = (inTop: boolean) => values.flatMap(({ f, v }) => (v === null || TOP_EIGHT.includes(f.id) !== inTop ? [] : [v]));
  const topValues = pick(true), rest = median(pick(false));
  const centre = median(topValues), side = Math.sign(centre - rest);
  const along = topValues.filter((v) => Math.sign(v - rest) === side).length;
  return `- **${handWritten(pattern.name)}** (${phrase}: top eight median ${fmt(centre)}, other eighteen median ${fmt(rest)}; `
    + `${along} of the ${topValues.length} ${side < 0 ? "below" : "above"} it): ${handWritten(pattern.guidance)}`;
}

function renderGuide(): string {
  if (TASTE.map((t) => t.id).join() !== TOP_EIGHT.join()) throw new Error("the taste guide must cover the top eight in order");
  return [
    "## What sets each one apart",
    "Each fighter's defining moves and attributes, with the measure from the tables above that shows it and its rank among the fighters with a value. "
      + "The rationale is our summary of the cited public pages; the numbers come from the generator, never from the prose.",
    ...TASTE.map(renderTaste),
    "## Shared patterns",
    "Traits most of the eight share, each with its measure, as candidate guidance for our fighters' budgets. "
      + "A count says how many of the eight sit on the same side of the other eighteen's median as the top eight's median.",
    PATTERNS.map(renderPattern).join("\n"),
  ].join("\n\n");
}

export function renderPage(): string {
  const header = [
    "# Melee's top eight against the cast",
    "",
    "Generated by `ts/scripts/meleeTopTiers.ts` from `references/melee-frame-data/`; do not edit by hand. "
      + "Run `bun scripts/meleeTopTiers.ts` in `ts/` to regenerate; `bun run check` fails when this page is stale.",
    "",
    `The top eight are ${top.map((f) => f.name).join(", ")}. Each table compares them with the other eighteen of the 26 fighters `
      + "(Sheik and Zelda counted apart, Popo standing for the Ice Climbers). "
      + "A group cell is the median with the range in brackets. A fighter cell is the value and its rank among the fighters with a value; "
      + "`=` marks a tie, and the Fighters column says how many have one. Frames count from 1. "
      + "The disc revision is not stated by the sources.",
  ].join("\n");
  return `${[header, ...SECTIONS.map(renderSection), renderGuide()].join("\n\n")}\n`;
}

if (import.meta.main) {
  const path = join(ROOT, PAGE), page = renderPage();
  const current = await Bun.file(path).exists() ? await Bun.file(path).text() : "";
  if (process.argv.includes("--check")) {
    if (current !== page) {
      console.error(`stale: ${PAGE}; run \`bun scripts/meleeTopTiers.ts\` in ts/`);
      process.exitCode = 1;
    }
  } else if (current !== page) {
    await Bun.write(path, page);
    console.log(`updated ${PAGE}`);
  }
}
