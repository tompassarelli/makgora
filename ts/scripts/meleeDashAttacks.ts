import { join, resolve } from "node:path";
import { Schema } from "effect";

const root = resolve(import.meta.dir, "../..");
const REFERENCES = join(root, "references/melee-frame-data");
const DOCUMENT = join(root, "docs/design/melee/attacks.md");
const BLOCK = /<!-- dash-attacks -->[\s\S]*?<!-- \/dash-attacks -->/;

const FrameRecord = Schema.Struct({
  character: Schema.String, action: Schema.NullOr(Schema.String),
  values: Schema.Record(Schema.String, Schema.NullOr(Schema.Finite)),
});

function csv(text: string): string[][] {
  return text.trim().split("\n").map((line) => [...line.matchAll(/(?:"([^"]*)"|([^,]*))(?:,|$)/g)].map((m) => m[1] ?? m[2] ?? ""));
}
const first = (cell: string | undefined): number => Number.parseFloat((cell ?? "").split("/")[0] ?? "");

const NAMES: Readonly<Record<string, string>> = {
  bowser: "Bowser", captain_falcon: "Captain Falcon", donkey_kong: "Donkey Kong", "dr._mario": "Dr. Mario", falco: "Falco", fox: "Fox",
  "mr._game_&_watch": "Mr. Game & Watch", ganondorf: "Ganondorf", ice_climbers: "Ice Climbers", jigglypuff: "Jigglypuff", kirby: "Kirby",
  link: "Link", luigi: "Luigi", mario: "Mario", marth: "Marth", mewtwo: "Mewtwo", ness: "Ness", peach: "Peach", pichu: "Pichu",
  pikachu: "Pikachu", roy: "Roy", samus: "Samus", sheik: "Sheik", yoshi: "Yoshi", young_link: "Young Link", zelda: "Zelda",
};
const ATTRIBUTE_NAMES: Readonly<Record<string, string>> = { "Dr Mario": "Dr. Mario", "Game & Watch": "Mr. Game & Watch" };

const records = (await Bun.file(join(REFERENCES, "records.jsonl")).text()).trim().split("\n")
  .map((line) => Schema.decodeUnknownSync(FrameRecord)(JSON.parse(line)))
  .filter((r) => r.action === "dattack");
const fightcore = new Map(csv(await Bun.file(join(REFERENCES, "fightcore.csv")).text()).filter((c) => c[2] === "Dashattack").map((c) => [c[0] ?? "", c]));
const [header = [], ...attributeRows] = csv(await Bun.file(join(REFERENCES, "character-attributes.csv")).text());
const column = (label: string): number => {
  const i = header.indexOf(label);
  if (i < 0) throw new Error(`character-attributes.csv has no column ${label}`);
  return i;
};
const RUN = column("Dash & Run Terminal Velocity"), WEIGHT = column("Weight");
const attributes = new Map(attributeRows.map((c) => [ATTRIBUTE_NAMES[c[0] ?? ""] ?? c[0] ?? "", { run: first(c[RUN]), weight: first(c[WEIGHT]) }]));

const shieldstunFromDamage = (damage: number): number => Math.floor((damage + 4.45) / 2.235);

interface DashAttack {
  readonly name: string;
  readonly startup: number;
  readonly lastActive: number;
  readonly actionable: number;
  readonly damage: number;
  readonly shieldstun: number;
  readonly run: number;
  readonly weight: number;
}
const dashAttacks: DashAttack[] = Object.entries(NAMES).map(([id, name]) => {
  const values = records.find((r) => r.character === id)?.values ?? {};
  const fc = fightcore.get(name);
  const body = attributes.get(name);
  if (fc === undefined || body === undefined) throw new Error(`no FightCore dash attack or attributes for ${name}`);
  const pick = (key: string, fallback: number): number => values[key] ?? fallback;
  const iasa = values.iasa ?? (Number.isFinite(first(fc[7])) ? first(fc[7]) : null);
  const total = pick("total", first(fc[6]));
  const damage = pick("percent", Math.max(...(fc[11] ?? "").replace("%", "").split("/").map(Number)));
  return {
    name, startup: pick("start", first(fc[4])), lastActive: pick("end", first(fc[5])), actionable: iasa ?? total + 1,
    damage, shieldstun: values.stun ?? shieldstunFromDamage(damage), run: body.run, weight: body.weight,
  };
}).sort((a, b) => a.name.localeCompare(b.name));
if (dashAttacks.length !== 26) throw new Error(`expected 26 dash attacks, got ${dashAttacks.length}`);

const span = (d: DashAttack): number => d.lastActive - d.startup + 1;
const endlag = (d: DashAttack): number => d.actionable - d.lastActive - 1;
const onShield = (d: DashAttack, contact: number): number => contact + d.shieldstun + 1 - d.actionable;
const early = (d: DashAttack): number => onShield(d, d.startup);
const late = (d: DashAttack): number => onShield(d, d.lastActive);

function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b), at = (sorted.length - 1) * q, lo = Math.floor(at), hi = Math.ceil(at);
  return (sorted[lo] ?? 0) + ((sorted[hi] ?? 0) - (sorted[lo] ?? 0)) * (at - lo);
}
function ranks(values: readonly number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v), out = new Array<number>(values.length).fill(0);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]?.v === order[i]?.v) j++;
    for (let k = i; k <= j; k++) out[order[k]?.i ?? 0] = (i + j) / 2;
    i = j + 1;
  }
  return out;
}
function spearman(a: readonly number[], b: readonly number[]): number {
  const ra = ranks(a), rb = ranks(b), n = ra.length, ma = ra.reduce((s, v) => s + v, 0) / n, mb = rb.reduce((s, v) => s + v, 0) / n;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) { const x = (ra[i] ?? 0) - ma, y = (rb[i] ?? 0) - mb; ab += x * y; aa += x * x; bb += y * y; }
  return ab / Math.sqrt(aa * bb);
}

const minus = (text: string): string => text.replace(/^-/, "−");
const signed = (v: number): string => (v > 0 ? `+${v}` : minus(String(Math.round(v * 10) / 10)));
const plain = (v: number): string => String(Math.round(v * 10) / 10);
const table = (head: readonly string[], align: string, rows: readonly (readonly string[])[]): string =>
  [head, [...align].map((a) => (a === "r" ? "---:" : "---")), ...rows].map((cells) => `| ${cells.join(" | ")} |`).join("\n");

const MEASURES: readonly { label: string; of: (d: DashAttack) => number; format: (v: number) => string }[] = [
  { label: "Startup", of: (d) => d.startup, format: plain },
  { label: "Active span", of: span, format: plain },
  { label: "Ending lag after the last hitbox", of: endlag, format: plain },
  { label: "Actionable", of: (d) => d.actionable, format: plain },
  { label: "Shieldstun", of: (d) => d.shieldstun, format: plain },
  { label: "On shield, first active frame", of: early, format: signed },
  { label: "On shield, last active frame", of: late, format: signed },
];
const correlation = (v: number): string => minus(v.toFixed(2));
const rule = table(["Measure", "Least", "Lower quartile", "Median", "Upper quartile", "Greatest", "Rank correlation with weight", "With run speed"], "lrrrrrrr",
  MEASURES.map((m) => {
    const vs = dashAttacks.map(m.of);
    return [m.label, ...[0, 0.25, 0.5, 0.75, 1].map((q) => m.format(quantile(vs, q))),
      correlation(spearman(dashAttacks.map((d) => d.weight), vs)), correlation(spearman(dashAttacks.map((d) => d.run), vs))];
  }));
const roster = table(
  ["Fighter", "Startup", "Last active", "Active span", "Ending lag", "Actionable", "Damage", "Shieldstun", "On shield, first", "On shield, last", "Run speed", "Weight"],
  "lrrrrrrrrrrr",
  dashAttacks.map((d) => [d.name, plain(d.startup), plain(d.lastActive), plain(span(d)), plain(endlag(d)), plain(d.actionable), plain(d.damage),
    plain(d.shieldstun), signed(early(d)), signed(late(d)), plain(d.run), plain(d.weight)]),
);
const block = `<!-- dash-attacks -->\n${rule}\n\n${roster}\n<!-- /dash-attacks -->`;

if (import.meta.main) {
  const text = await Bun.file(DOCUMENT).text();
  if (!BLOCK.test(text)) throw new Error("attacks.md has no dash-attacks block");
  const rendered = text.replace(BLOCK, block);
  if (process.argv.includes("--check")) {
    if (rendered !== text) console.log("stale: docs/design/melee/attacks.md dash-attacks block");
    process.exitCode = rendered === text ? 0 : 1;
  } else {
    await Bun.write(DOCUMENT, rendered);
    console.log(block);
  }
}
