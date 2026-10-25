// Foreign-data boundary only: reduces FightCore's public Fox and Falco move pages to hitbox phases and
// knockdown-threshold percents per target fighter.
// Usage: bun fightcore-intake.ts PAGES_DIRECTORY OUTPUT_DIRECTORY
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIGHTCORE_COLUMNS, type FightCoreRow, readFightCore } from "./fightcore";

const site = "https://www.fightcore.gg";
const attackers = ["fox", "falco"];
const [pagesArgument, outputArgument] = process.argv.slice(2);
if (pagesArgument === undefined || outputArgument === undefined) throw new Error("Usage: bun fightcore-intake.ts PAGES_DIRECTORY OUTPUT_DIRECTORY");
const pagesDirectory: string = pagesArgument, outputDirectory: string = outputArgument;

const characterIds = new Map<string, [number, string]>([
  ["bowser", [241, "bowser"]], ["captainfalcon", [227, "captain_falcon"]], ["donkeykong", [242, "donkey_kong"]],
  ["drmario", [215, "dr._mario"]], ["falco", [218, "falco"]], ["fox", [224, "fox"]], ["ganondorf", [216, "ganondorf"]],
  ["iceclimbers", [209, "ice_climbers"]], ["jigglypuff", [214, "jigglypuff"]], ["kirby", [210, "kirby"]],
  ["link", [238, "link"]], ["luigi", [213, "luigi"]], ["mario", [236, "mario"]], ["marth", [222, "marth"]],
  ["mewtwo", [217, "mewtwo"]], ["mrgame&watch", [219, "mr._game_&_watch"]], ["ness", [243, "ness"]],
  ["peach", [240, "peach"]], ["pichu", [221, "pichu"]], ["pikachu", [237, "pikachu"]], ["roy", [223, "roy"]],
  ["samus", [212, "samus"]], ["sheik", [260, "sheik"]], ["yoshi", [211, "yoshi"]], ["younglink", [220, "young_link"]],
  ["zelda", [239, "zelda"]],
]);
const moveTypes = ["unknown", "tilt", "grounded", "air", "special", "dodge", "throw", "tech", "edge_attack", "item", "kirby_special"];
const thresholdTypes = new Set([0, 1, 2, 3, 4, 7, 8, 10]);
const knockbackTargets = [80, 120, 32, 48] as const;
const sakuraiOnly = new Set([32, 48]);
const cardTitles = new Map<string, number>([
  ["ASDI Down", 80], ["Crouch-Cancel", 120],
  ["Sakurai Angle starts being ASDI-Downable", 32], ["Sakurai Angle starts being Crouch-Cancellable", 48],
]);
const queueSlots = [0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01];

type Hitbox = {
  name: string; damage: number; angle: number; baseKnockback: number; knockbackGrowth: number; setKnockback: number;
  effect: string; isWeightIndependent: boolean; hitlagAttacker: number; hitlagDefender: number;
  hitlagAttackerCrouched: number; hitlagDefenderCrouched: number; shieldstun: number;
};
type Hit = { start: number; end: number; hitboxes: Hitbox[] };
type Move = { id: number; name: string; normalizedName: string; type: number; hits: Hit[] | null };
type Character = { name: string; normalizedName: string; fightCoreId: number; characterStatistics: { weight: number }; moves: Move[] };
type Page = { url: string; fetched: string; buildId: string; html: string; data: Record<string, unknown> };

mkdirSync(pagesDirectory, { recursive: true });
const manifestPath = join(pagesDirectory, "manifest.json");
const manifest: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
let lastFetch = 0;

async function page(path: string): Promise<Page> {
  const url = `${site}${path}`;
  const file = join(pagesDirectory, `${path.replaceAll(/[^a-z0-9]+/gi, "_")}.html`);
  if (!existsSync(file) || manifest[url] === undefined) {
    await Bun.sleep(Math.max(0, lastFetch + 1000 - Date.now()));
    lastFetch = Date.now();
    const response = await fetch(url, { headers: { "user-agent": "smashcraft-reference-intake" } });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    writeFileSync(file, await response.text());
    manifest[url] = new Date().toISOString().slice(0, 10);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const html = readFileSync(file, "utf8");
  const script = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s.exec(html)?.[1];
  if (script === undefined) throw new Error(`${url}: no page data`);
  const next = JSON.parse(script) as { buildId: string; props: { pageProps: { data: Record<string, unknown> } } };
  return { url, fetched: manifest[url] ?? "", buildId: next.buildId, html, data: next.props.pageProps.data };
}

const characterPath = (normalizedName: string): string => {
  const [id] = characterIds.get(normalizedName) ?? [];
  if (id === undefined) throw new Error(`Unknown fighter ${normalizedName}`);
  return `/characters/${id}/${encodeURIComponent(normalizedName)}/`;
};

const targets: { key: string; name: string; weight: number }[] = [];
const characters = new Map<string, Character>();
for (const normalizedName of [...characterIds.keys()].sort()) {
  const { data } = await page(characterPath(normalizedName));
  const character = data.character as Character;
  if (character.normalizedName !== normalizedName || character.characterStatistics.weight <= 0) throw new Error(`Unexpected fighter page ${normalizedName}`);
  characters.set(normalizedName, character);
  targets.push({ key: characterIds.get(normalizedName)?.[1] ?? "", name: character.name, weight: character.characterStatistics.weight });
}
targets.sort((a, b) => (a.name > b.name ? 1 : -1));

// FightCore's staleness queue adds slot reductions in JavaScript doubles, and its percent depends on that sum.
const staleness = queueSlots.reduce<number[]>((levels, slot) => [...levels, (levels.at(-1) ?? 0) + slot], [0]);

type Percent = number | "never";
function threshold(hitbox: Hitbox, weight: number, knockbackTarget: number, stale: number): Percent {
  if (hitbox.setKnockback) {
    const knockback = (((hitbox.setKnockback * 10) / 20 + 1) * 1.4 * (200 / (weight + 100)) + 18) * (hitbox.knockbackGrowth / 100) + hitbox.baseKnockback;
    return knockback >= knockbackTarget ? 0 : "never";
  }
  if (hitbox.knockbackGrowth === 0) return "never";
  const percent = ((100 + weight) / 14) * (((100 / hitbox.knockbackGrowth) * (knockbackTarget - hitbox.baseKnockback) - 18) / (hitbox.damage + 2))
    - (hitbox.damage - stale * hitbox.damage);
  if (percent === Infinity) return "never";
  return percent > 0 ? Math.ceil(percent) : 0;
}

const decode = (text: string): string => text.replaceAll("&amp;", "&").replaceAll("&#x27;", "'").replaceAll("&quot;", '"');

function renderedCards(html: string): Map<number, Map<string, Percent>> {
  const cards = new Map<number, Map<string, Percent>>();
  const tokens = /<div class="text-md">([^<]*)<\/div><div class="text-small text-default-500">(\d+)<!-- --> units of knockback<\/div>|alt="([^"]*)"|<span class="inline">([^<]*)<\/span>/g;
  let card: Map<string, Percent> | undefined;
  let target: string | undefined;
  for (const [, title, units, alt, shown] of html.matchAll(tokens)) {
    if (title !== undefined) {
      const knockbackTarget = Number(units);
      if (cardTitles.get(decode(title)) !== knockbackTarget || cards.has(knockbackTarget)) throw new Error(`Unexpected card ${title}`);
      card = new Map();
      cards.set(knockbackTarget, card);
    } else if (alt !== undefined) target = decode(alt);
    else if (shown !== undefined && card !== undefined && target !== undefined && card.size < targets.length) {
      const value = shown === "Never breaks" ? "never" : Number(/^(\d+)%$/.exec(shown)?.[1] ?? Number.NaN);
      if (value !== "never" && !Number.isInteger(value)) throw new Error(`Unexpected percent ${shown}`);
      card.set(target, value);
      target = undefined;
    }
  }
  return cards;
}

const source = (from: Page) => ({ site, url: from.url, fetched: from.fetched, build_id: from.buildId });
const phases: unknown[] = [];
const thresholds: unknown[] = [];
const pagedMoves = new Map<string, Move>();
let checkedCards = 0;
for (const attacker of attackers) {
  const character = characters.get(attacker);
  if (character === undefined) throw new Error(`Missing ${attacker}`);
  const moves = character.moves.filter((move) => (move.hits ?? []).length > 0).sort((a, b) => a.id - b.id);
  for (const listed of moves) {
    const from = await page(`${characterPath(attacker)}moves/${listed.id}/${listed.normalizedName}/`);
    const move = from.data.move as Move;
    if (move.id !== listed.id) throw new Error(`${from.url}: wrong move`);
    pagedMoves.set(`${attacker}/${move.id}`, move);
    const hits = [...(move.hits ?? [])].sort((a, b) => a.start - b.start || a.end - b.end);
    const identity = { character: characterIds.get(attacker)?.[1], move: move.normalizedName, move_name: move.name, move_type: moveTypes[move.type] };
    hits.forEach((hit, index) => {
      const hitboxes = [...hit.hitboxes].sort((a, b) => (a.name > b.name ? 1 : -1));
      phases.push({
        schema_version: 1, ...identity, phase: index + 1, start: hit.start, end: hit.end,
        hitboxes: hitboxes.map((hitbox) => ({
          name: hitbox.name, damage: hitbox.damage, angle: hitbox.angle, base_knockback: hitbox.baseKnockback,
          knockback_growth: hitbox.knockbackGrowth, set_knockback: hitbox.setKnockback, effect: hitbox.effect,
          weight_independent: hitbox.isWeightIndependent,
          hitlag_attacker: hitbox.hitlagAttacker, hitlag_defender: hitbox.hitlagDefender,
          hitlag_attacker_crouched: hitbox.hitlagAttackerCrouched, hitlag_defender_crouched: hitbox.hitlagDefenderCrouched,
          shieldstun: hitbox.shieldstun,
        })),
        source: source(from),
      });
      if (!thresholdTypes.has(move.type)) return;
      const groups = new Map<string, Hitbox[]>();
      for (const hitbox of hitboxes) {
        const key = [hitbox.damage, hitbox.angle, hitbox.baseKnockback, hitbox.knockbackGrowth, hitbox.setKnockback].join("/");
        groups.set(key, [...(groups.get(key) ?? []), hitbox]);
      }
      for (const group of groups.values()) {
        const [hitbox] = group;
        if (hitbox === undefined) continue;
        const listedTargets = knockbackTargets.filter((knockbackTarget) => hitbox.angle === 361 || !sakuraiOnly.has(knockbackTarget));
        for (const target of targets) {
          thresholds.push({
            schema_version: 1, ...identity, phase: index + 1, start: hit.start, end: hit.end, hitboxes: group.map(({ name }) => name),
            target: target.key, target_weight: target.weight,
            staleness: staleness.map((level) => Number(level.toFixed(2))),
            percent: Object.fromEntries(listedTargets.map((knockbackTarget) => [
              String(knockbackTarget), staleness.map((level) => threshold(hitbox, target.weight, knockbackTarget, level)),
            ])),
            source: source(from),
          });
        }
      }
    });
    const cards = renderedCards(from.html);
    const shownHitbox = move.hits?.[0]?.hitboxes[0];
    if (!thresholdTypes.has(move.type)) {
      if (cards.size > 0) throw new Error(`${from.url}: thresholds shown for a move type without them`);
      continue;
    }
    if (shownHitbox === undefined || cards.size !== (shownHitbox.angle === 361 ? 4 : 2)) throw new Error(`${from.url}: expected threshold cards`);
    for (const [knockbackTarget, card] of cards) {
      if (card.size !== targets.length) throw new Error(`${from.url}: card ${knockbackTarget} lists ${card.size} fighters`);
      for (const target of targets) {
        const expected = threshold(shownHitbox, target.weight, knockbackTarget, 0);
        if (card.get(target.name) !== expected) throw new Error(`${from.url}: ${knockbackTarget} vs ${target.name} shows ${card.get(target.name)}, computed ${expected}`);
      }
      checkedCards += 1;
    }
  }
}

const lines = (records: unknown[]): string => records.map((record) => JSON.stringify(record)).join("\n") + "\n";
writeFileSync(join(outputDirectory, "fightcore-phases.jsonl"), lines(phases));
writeFileSync(join(outputDirectory, "fightcore-thresholds.jsonl"), lines(thresholds));
console.log(`${phases.length} phases, ${thresholds.length} threshold rows; ${checkedCards} rendered cards match the computed staleness-0 percents`);

const exportRows = readFightCore(join(import.meta.dir, "../.."));
const valueSet = (values: readonly number[]): string => [...new Set(values.length === 0 ? [0] : values)].sort((a, b) => a - b).join(" / ");
const fields: [keyof Pick<FightCoreRow, "damage" | "angle" | "baseKnockback" | "knockbackGrowth" | "setKnockback">, keyof Hitbox][] = [
  ["damage", "damage"], ["angle", "angle"], ["baseKnockback", "baseKnockback"], ["knockbackGrowth", "knockbackGrowth"], ["setKnockback", "setKnockback"],
];
const differences: string[] = [];
for (const attacker of attackers) {
  const character = characters.get(attacker);
  for (const move of character?.moves ?? []) {
    const hits = pagedMoves.get(`${attacker}/${move.id}`)?.hits ?? [];
    const hitboxes = hits.flatMap((hit) => hit.hitboxes);
    if (hitboxes.length === 0) continue;
    const row = exportRows.find((exported) => exported.character === character?.name && exported.move === move.name);
    if (row === undefined) {
      differences.push(`${attacker} ${move.name}: no fightcore.csv row`);
      continue;
    }
    for (const [exportedField, pagedField] of fields) {
      const exported = valueSet(row[exportedField]);
      const paged = valueSet(hitboxes.map((hitbox) => Number(hitbox[pagedField])));
      if (exported !== paged) differences.push(`${attacker} ${move.name} ${FIGHTCORE_COLUMNS[exportedField]}: fightcore.csv ${exported}, pages ${paged}`);
    }
    const ranged = hits.filter((hit) => hit.end > 0);
    const exportedActive = row.firstActive === null ? "-" : `${row.firstActive}-${row.lastActive}`;
    const pagedActive = ranged.length === 0 ? "-" : `${Math.min(...ranged.map((hit) => hit.start))}-${Math.max(...ranged.map((hit) => hit.end))}`;
    if (exportedActive !== pagedActive) differences.push(`${attacker} ${move.name} active frames: fightcore.csv ${exportedActive}, pages ${pagedActive}`);
  }
}
console.log(differences.length === 0 ? "phases agree with fightcore.csv" : differences.join("\n"));
