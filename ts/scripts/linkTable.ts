import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Character } from "../src/game/sim/codes";
import { fighterName } from "../src/game/roster/kits";
import type { LinkRow } from "./comboLinks";

export const LINKS_DIR = join(import.meta.dir, "../../tools/move-data/links");

export const linkSlug = (attacker: Character): string => (fighterName(attacker).split(" ")[0] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function readLinkTable(attacker: Character): readonly LinkRow[] | undefined {
  const file = join(LINKS_DIR, `${linkSlug(attacker)}.jsonl`);
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8").split("\n").filter((line) => line.length > 0).map((line) => JSON.parse(line) as LinkRow);
}

export const LINK_OPTIONS = ["d launcher", "e early kill", "g launch angle", "k shield pressure"] as const;
export type LinkOption = (typeof LINK_OPTIONS)[number];

export interface LinkEvidence {
  readonly option: LinkOption;
  readonly won: boolean;
  readonly value: string;
  readonly row: string | undefined;
}

export const FOX_WEIGHT = 75;
const LOW_PERCENT = 30;
const MARKED = 20;
const LOW_ANGLE = 20;

export const rowName = (row: LinkRow): string => `${row.opener} ${row.region} ${row.percent}% weight ${row.weight} into ${row.followUp}`;

const lowest = <T>(rows: readonly T[], key: (row: T) => number): T | undefined =>
  rows.reduce<T | undefined>((best, row) => (best === undefined || key(row) < key(best) ? row : best), undefined);

function launcher(smash: readonly LinkRow[]): LinkEvidence {
  const combo = lowest(smash.filter((row) => row.percent <= LOW_PERCENT && (row.class === "true" || row.class === "DI-dependent")), (row) => row.percent);
  const best = lowest(smash.filter((row) => row.percent <= LOW_PERCENT && row.advantage !== undefined), (row) => -(row.advantage ?? 0));
  const shown = combo ?? best;
  return {
    option: "d launcher", won: combo !== undefined, row: shown === undefined ? undefined : rowName(shown),
    value: combo !== undefined ? `${combo.class} into ${combo.followUp} at ${combo.percent}%, ${combo.advantage ?? 0} on hit` : `no true or DI-dependent link up to ${LOW_PERCENT}%, best ${best?.advantage ?? "none"} on hit`,
  };
}

function earlyKill(smash: readonly LinkRow[], others: readonly LinkRow[]): LinkEvidence {
  const at = (rows: readonly LinkRow[], kills: (row: LinkRow) => boolean) => lowest(rows.filter(kills), (row) => row.percent);
  const show = (row: LinkRow | undefined): string => (row === undefined ? "none" : `${row.percent}% (${row.opener})`);
  const centre = at(smash, (row) => row.ko === true);
  const ledge = at(smash, (row) => row.ledgeKo === true);
  const otherCentre = at(others, (row) => row.ko === true);
  const otherLedge = at(others, (row) => row.ledgeKo === true);
  const marked = (own: LinkRow | undefined, other: LinkRow | undefined): boolean => own !== undefined && own.percent <= (other?.percent ?? Infinity) - MARKED;
  const won = marked(centre, otherCentre) ? centre : marked(ledge, otherLedge) ? ledge : undefined;
  const cited = won ?? centre ?? ledge;
  return {
    option: "e early kill", won: won !== undefined, row: cited === undefined ? undefined : rowName(cited),
    value: `KO centre ${show(centre)} against ${show(otherCentre)}, ledge ${show(ledge)} against ${show(otherLedge)}`,
  };
}

function launchAngle(smash: readonly LinkRow[]): LinkEvidence {
  const low = lowest(smash.filter((row) => row.angle !== undefined), (row) => row.angle ?? 0);
  return {
    option: "g launch angle", won: low !== undefined && (low.angle ?? 0) <= LOW_ANGLE, row: low === undefined ? undefined : rowName(low),
    value: low === undefined ? "never lifts the victim" : `lowest launch ${low.angle}° at ${low.percent}%`,
  };
}

function shieldPressure(smash: readonly LinkRow[], tilt: readonly LinkRow[]): LinkEvidence {
  const best = (rows: readonly LinkRow[]) => lowest(rows.filter((row) => row.shieldBreak === true || row.shieldAdvantage !== undefined), (row) => (row.shieldBreak === true ? -Infinity : -(row.shieldAdvantage ?? 0)));
  const show = (row: LinkRow | undefined): string => (row === undefined ? "no shield hit" : row.shieldBreak === true ? "breaks a full shield" : `${row.shieldAdvantage}, ${row.shieldDamage} damage`);
  const own = best(smash);
  const tilts = best(tilt);
  const won = own !== undefined && (own.shieldBreak === true || (own.shieldAdvantage !== undefined && tilts?.shieldAdvantage !== undefined && own.shieldAdvantage >= tilts.shieldAdvantage));
  return { option: "k shield pressure", won, row: own === undefined ? undefined : rowName(own), value: `on shield ${show(own)} against tilt ${show(tilts)}` };
}

export function linkOptions(table: readonly LinkRow[], smash: string, tilt: string): readonly LinkEvidence[] {
  const fox = table.filter((row) => row.weight === FOX_WEIGHT);
  const own = fox.filter((row) => row.opener === smash);
  return [launcher(own), earlyKill(own, fox.filter((row) => !row.opener.endsWith(" smash"))), launchAngle(own), shieldPressure(own, fox.filter((row) => row.opener === tilt))];
}
