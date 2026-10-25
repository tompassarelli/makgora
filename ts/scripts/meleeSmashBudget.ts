import { join, resolve } from "node:path";
import { Schema } from "effect";

const root = resolve(import.meta.dir, "../..");
const corpus = (file: string): string => join(root, "references/melee-frame-data", file);

const FrameRecord = Schema.Struct({
  character: Schema.String, category: Schema.String, action: Schema.NullOr(Schema.String),
  values: Schema.Record(Schema.String, Schema.NullOr(Schema.Finite)),
});
const Hitbox = Schema.Struct({ size: Schema.Finite, x: Schema.Finite, y: Schema.Finite });
const MotionRecord = Schema.Struct({
  character: Schema.String, category: Schema.String, action: Schema.String,
  hitbox_frames: Schema.Array(Schema.Struct({ frame: Schema.Finite, hitboxes: Schema.Array(Hitbox) })),
  locomotion_x: Schema.NullOr(Schema.Array(Schema.Finite)),
});
const ReplayTravel = Schema.Struct({
  character: Schema.String, category: Schema.String, action: Schema.String, locomotion_x: Schema.Array(Schema.Finite),
});
type FrameRecord = typeof FrameRecord.Type;
type MotionRecord = typeof MotionRecord.Type;

const jsonl = async <S extends Schema.Top>(file: string, schema: S): Promise<S["Type"][]> =>
  (await Bun.file(corpus(file)).text()).trim().split("\n").map((line) => {
    const value: unknown = JSON.parse(line);
    Schema.asserts(schema, value);
    return value;
  });
const csv = async (file: string): Promise<Record<string, string>[]> => {
  const [header, ...rows] = (await Bun.file(corpus(file)).text()).trim().split("\n")
    .map((line) => [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map((m) => (m[1] ?? "").replace(/^"|"$/g, "").replaceAll('""', '"')));
  if (header === undefined) throw new Error(`${file} is empty`);
  return rows.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])));
};

const NAMES: Readonly<Record<string, string>> = {
  mario: "Mario", fox: "Fox", captain_falcon: "Captain Falcon", donkey_kong: "Donkey Kong", kirby: "Kirby",
  bowser: "Bowser", link: "Link", sheik: "Sheik", ness: "Ness", peach: "Peach", ice_climbers: "Ice Climbers",
  pikachu: "Pikachu", samus: "Samus", yoshi: "Yoshi", jigglypuff: "Jigglypuff", mewtwo: "Mewtwo", luigi: "Luigi",
  marth: "Marth", zelda: "Zelda", young_link: "Young Link", "dr._mario": "Dr. Mario", falco: "Falco", pichu: "Pichu",
  "mr._game_&_watch": "Mr. Game & Watch", ganondorf: "Ganondorf", roy: "Roy",
};
const FIGHTCORE_MOVES: Readonly<Record<string, string>> = {
  ftilt: "Forward Tilt", utilt: "Up Tilt", dtilt: "Down Tilt", fsmash: "Forward Smash", usmash: "Up Smash", dsmash: "Down Smash",
};
const DIRECTIONS = [
  { name: "Forward", smash: "fsmash", tilt: "ftilt" },
  { name: "Up", smash: "usmash", tilt: "utilt" },
  { name: "Down", smash: "dsmash", tilt: "dtilt" },
] as const;
const TRAVEL_MOVES = ["jab1", "ftilt", "utilt", "dtilt", "fsmash", "usmash", "dsmash", "dattack"] as const;
const LOW_ANGLE = 25;
const GEOMETRY_TIE = 0.5;
const SWEETSPOT = 1.2;

const records = await jsonl("records.jsonl", FrameRecord);
const recorded = await jsonl("libmelee.jsonl", MotionRecord);
const measured = await jsonl("replay-dash-attacks.jsonl", ReplayTravel);
const motion: MotionRecord[] = [
  ...recorded,
  ...measured.filter((m) => !recorded.some((r) => r.character === m.character && r.category === m.category && r.action === m.action))
    .map((m) => ({ ...m, hitbox_frames: [] })),
];
const fightcore = await csv("fightcore.csv");
const intangibility = await csv("smashwiki-intangibility.csv");
const record = (id: string, action: string): FrameRecord | undefined =>
  records.find((r) => r.character === id && r.category === "attacks" && r.action === action);
const value = (r: FrameRecord | undefined, key: string): number | null => r?.values[key] ?? null;
const motionOf = (id: string, action: string): MotionRecord | undefined =>
  motion.find((m) => m.character === id && m.category === "attacks" && m.action === action);
const fighters = [...new Set(records.filter((r) => r.category === "misc").map((r) => r.character))]
  .sort((a, b) => (NAMES[a] ?? a).localeCompare(NAMES[b] ?? b));
if (fighters.length !== 26) throw new Error(`expected 26 fighters, got ${fighters.length}`);

interface Geometry { reach: number; still: number; travel: number; behind: number; height: number; offset: number }
function geometry(m: MotionRecord | undefined): Geometry | null {
  if (m === undefined || m.hitbox_frames.length === 0 || m.locomotion_x === null) return null;
  const steps = m.locomotion_x;
  const travelAt = (frame: number): number => steps.slice(0, frame).reduce((s, v) => s + v, 0);
  const boxes = m.hitbox_frames.flatMap((f) => f.hitboxes.map((h) => ({ ...h, travel: travelAt(f.frame) })));
  const at = (pick: (h: (typeof boxes)[number]) => number): number => Math.max(...boxes.map(pick));
  const farthest = boxes.reduce((best, h) => (h.travel + h.x + h.size > best.travel + best.x + best.size ? h : best));
  return {
    reach: farthest.travel + farthest.x + farthest.size, still: at((h) => h.x + h.size), travel: farthest.travel,
    behind: at((h) => h.size - h.x - h.travel), height: at((h) => h.y + h.size), offset: at((h) => Math.abs(h.x)),
  };
}

interface Move {
  startup: number | null; total: number | null; active: number | null; damage: number | null; sweetspot: number | null;
  shieldstun: number | null; onShield: number | null; angles: number[]; geometry: Geometry | null; intangible: string | null;
}
function move(id: string, action: string): Move | null {
  const r = record(id, action);
  if (r === undefined) return null;
  const start = value(r, "start"), end = value(r, "end"), total = value(r, "total"), stun = value(r, "stun");
  const strong = value(r, "percent"), weak = value(r, "percent_weak");
  const actionable = value(r, "iasa") ?? (total === null ? null : total + 1);
  const row = fightcore.find((c) => c["Character"] === NAMES[id] && c["Move"] === FIGHTCORE_MOVES[action]);
  const wiki = intangibility.find((c) => c["character"] === id && c["action"] === action);
  return {
    startup: start, total, active: start === null || end === null ? null : end - start + 1, damage: strong,
    sweetspot: strong === null || weak === null || weak === 0 ? null : strong / weak, shieldstun: stun,
    onShield: end === null || stun === null || actionable === null ? null : end + stun + 1 - actionable,
    angles: (row?.["Angle"] ?? "").split("/").filter((a) => a.trim() !== "").map((a) => Number(a.trim())).filter((a) => Number.isFinite(a)),
    geometry: geometry(motionOf(id, action)),
    intangible: wiki === undefined ? null : `${wiki["first_frame"]}–${wiki["last_frame"]}`,
  };
}

const toolAngle = (angles: readonly number[]): boolean => angles.some((a) => a !== 361 && (a <= LOW_ANGLE || (a > 180 && a < 360)));
const more = (a: number | null | undefined, b: number | null | undefined, tie = 0): boolean => a != null && b != null && a > b + tie;

function wins(direction: (typeof DIRECTIONS)[number], s: Move, t: Move): string[] {
  const sg = s.geometry, tg = t.geometry;
  const reachOf = (g: Geometry | null): number | null => (g === null ? null : direction.name === "Up" ? g.height : g.reach);
  const sr = reachOf(sg), tr = reachOf(tg);
  const won: string[] = [];
  if (sr !== null && tr !== null && sr >= tr - GEOMETRY_TIE) won.push("a reach");
  if (more(s.active, t.active)) won.push("b active");
  if (more(s.damage, t.damage)) won.push("f damage");
  if (toolAngle(s.angles) && !toolAngle(t.angles)) won.push("g angle");
  const coverage = direction.name === "Up" ? more(sg?.height, tg?.height, GEOMETRY_TIE) : more(sg?.behind, Math.max(tg?.behind ?? 0, 0), GEOMETRY_TIE);
  if (coverage) won.push("h coverage");
  if (more(sg?.offset, tg?.offset, GEOMETRY_TIE)) won.push("i disjoint");
  if (s.intangible !== null && t.intangible === null) won.push("j intangible");
  if (s.onShield !== null && t.onShield !== null && s.onShield >= t.onShield) won.push("k shield");
  if (s.sweetspot !== null && s.sweetspot >= Math.max(t.sweetspot ?? 1, SWEETSPOT)) won.push("l sweetspot");
  if (direction.smash === "usmash") won.push("m out of shield");
  return won;
}

const f0 = (v: number | null | undefined): string => (v == null ? "–" : `${Math.round(v)}`);
const f1 = (v: number | null | undefined): string => (v == null ? "–" : v.toFixed(1).replace("-", "−"));
const signed = (v: number | null | undefined): string => (v == null ? "–" : v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
const pair = (a: string, b: string): string => `${a} / ${b}`;
const mean = (xs: number[]): number => xs.reduce((s, v) => s + v, 0) / xs.length;

const lines: string[] = [];
const tally = new Map<string, number>();
for (const direction of DIRECTIONS) {
  lines.push(`### ${direction.name} smash against ${direction.name.toLowerCase()} tilt`, "",
    "Each cell is smash / tilt. Reach includes the fighter's own travel up to the frame of the farthest hitbox (travel shown for the smash); up moves compare height.", "",
    "| Fighter | Startup | Total | Active | Reach (smash travel) | Behind | Height | Hitbox offset | Damage | Strong ÷ weak | Angles | Shieldstun | On shield, last active | Intangible | Out of shield | Smash wins on |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | --- | --- |");
  const later: boolean[] = [], longer: boolean[] = [], reachStill: boolean[] = [], options: number[] = [];
  for (const id of fighters) {
    const s = move(id, direction.smash), t = move(id, direction.tilt);
    if (s === null || t === null) {
      lines.push(`| ${NAMES[id]} | no ${s === null ? "smash" : "tilt"} record |  |  |  |  |  |  |  |  |  |  |  |  |  |  |`);
      continue;
    }
    const won = wins(direction, s, t);
    for (const w of won) tally.set(`${direction.name}/${w}`, (tally.get(`${direction.name}/${w}`) ?? 0) + 1);
    if (s.startup !== null && t.startup !== null) later.push(s.startup > t.startup);
    if (s.total !== null && t.total !== null) longer.push(s.total > t.total);
    if (direction.name !== "Up" && s.geometry !== null && t.geometry !== null) reachStill.push(s.geometry.still >= t.geometry.still - GEOMETRY_TIE);
    options.push(won.filter((w) => !w.startsWith("m")).length);
    const sg = s.geometry, tg = t.geometry;
    lines.push(`| ${NAMES[id]} | ${pair(f0(s.startup), f0(t.startup))} | ${pair(f0(s.total), f0(t.total))} | ${pair(f0(s.active), f0(t.active))} | ${pair(f1(sg?.reach), f1(tg?.reach))} (${f1(sg?.travel)}) | ${pair(f1(sg?.behind), f1(tg?.behind))} | ${pair(f1(sg?.height), f1(tg?.height))} | ${pair(f1(sg?.offset), f1(tg?.offset))} | ${pair(f0(s.damage), f0(t.damage))} | ${pair(f1(s.sweetspot), f1(t.sweetspot))} | ${pair(s.angles.join(" ") || "–", t.angles.join(" ") || "–")} | ${pair(f0(s.shieldstun), f0(t.shieldstun))} | ${pair(signed(s.onShield), signed(t.onShield))} | ${pair(s.intangible ?? "–", t.intangible ?? "–")} | ${direction.smash === "usmash" ? `jump squat, hits frame ${f0((s.startup ?? 0) + 1)}` : "after shield release"} | ${won.join(", ") || "none"} |`);
  }
  const counted = DIRECTIONS.find((d) => d === direction) === undefined ? 0 : options.length;
  lines.push("", `${later.filter(Boolean).length} of ${later.length} smashes start later than the tilt and ${longer.filter(Boolean).length} of ${longer.length} last longer.${reachStill.length === 0 ? "" : ` Without the fighter\x27s travel, ${reachStill.filter(Boolean).length} of ${reachStill.length} would win on reach.`} Options won per smash, out of shield aside: mean ${mean(options).toFixed(1)}, none for ${options.filter((n) => n === 0).length} of ${options.length}.`, "");
}

lines.push("### Smashes winning each option", "", "| Option | Forward | Up | Down |", "| --- | ---: | ---: | ---: |");
for (const option of ["a reach", "b active", "f damage", "g angle", "h coverage", "i disjoint", "j intangible", "k shield", "l sweetspot", "m out of shield"]) {
  lines.push(`| ${option} | ${DIRECTIONS.map((d) => tally.get(`${d.name}/${option}`) ?? 0).join(" | ")} |`);
}

const missing = fighters.flatMap((id) => TRAVEL_MOVES.filter((action) => motionOf(id, action)?.locomotion_x == null).map((action) => `${NAMES[id]} ${action}`));
const fromReplays = measured.map((m) => `${NAMES[m.character] ?? m.character} ${m.action}`);
lines.push("", `Forward travel by frame is recorded for ${fighters.length * TRAVEL_MOVES.length - missing.length} of ${fighters.length * TRAVEL_MOVES.length} moves${fromReplays.length === 0 ? "" : `, measured from public replays for ${fromReplays.join(", ")}`}${missing.length === 0 ? "" : `; none is recorded for ${missing.join(", ")}`}.`);
console.log(lines.join("\n"));
