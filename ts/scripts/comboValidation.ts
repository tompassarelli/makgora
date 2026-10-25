import type { LinkClass, LinkRow, Region } from "./comboLinks";

export const FOX_FIXTURE = "fixture:fox";

export type Expected = "true" | "DI-dependent" | "non-combo";

export interface ComboCase {
  readonly opener: string;
  readonly region: Region;
  readonly percent: number;
  readonly followUp: string;
  readonly expected: Expected;
  readonly source: string;
  readonly says: string;
}

const wiki = (page: string): string => `https://www.ssbwiki.com/${page}`;
const UP_THROW = wiki("Fox_(SSBM)/Up_throw");
const DOWN_AIR = wiki("Fox_(SSBM)/Down_aerial");

export const FOX_CASES: readonly ComboCase[] = [
  { opener: "down air", region: "clean", percent: 0, followUp: "grab", expected: "true", source: DOWN_AIR, says: "the drill, timed from the second airborne frame, true combos into grab" },
  { opener: "down air", region: "clean", percent: 0, followUp: "down tilt", expected: "true", source: DOWN_AIR, says: "the drill true combos into down tilt; Fox (SSBM)/Down_tilt: down tilt true combos from the unstaled drill" },
  { opener: "down air", region: "clean", percent: 0, followUp: "down special", expected: "true", source: DOWN_AIR, says: "the drill is followed by a waveshine to continue the combo" },
  { opener: "neutral air", region: "clean", percent: 10, followUp: "down special", expected: "non-combo", source: wiki("Fox_(SSBM)/Neutral_aerial"), says: "the clean hit leads into a waveshine, but crouch cancel beats it on lightweights until the low 60s and ASDI down until about half that, so at 10% a victim holding down escapes" },
  { opener: "up throw", region: "clean", percent: 30, followUp: "grab", expected: "true", source: UP_THROW, says: "against Fox, up throw chains into itself regardless of DI from 0 to 54% at the higher port and to 66% at the lower" },
  { opener: "up throw", region: "clean", percent: 30, followUp: "up tilt", expected: "DI-dependent", source: UP_THROW, says: "at about 20-40% an up throw that is not DI'd is followed by up tilt, and the combo works as long as the victim does not DI" },
  { opener: "up throw", region: "clean", percent: 80, followUp: "up smash", expected: "DI-dependent", source: UP_THROW, says: "at higher percents up throw combos into up smash when the victim DIs in, and without DI up to 102%; other DI escapes" },
  { opener: "up throw", region: "clean", percent: 90, followUp: "grab", expected: "non-combo", source: UP_THROW, says: "the chain grab on Fox ends at 66% regardless of DI and at 86% at best, so a regrab at 90% is no combo" },
  { opener: "down throw", region: "clean", percent: 30, followUp: "grab", expected: "non-combo", source: wiki("Fox_(SSBM)/Down_throw"), says: "against most of the cast down throw leads to a tech chase that must read the tech option, not react to it" },
  { opener: "down special", region: "clean", percent: 0, followUp: "neutral air", expected: "non-combo", source: wiki("Fox_(SSBM)/Down_special"), says: "a shine on a grounded Fox puts him in tumble and he can tech, escaping the punish" },
];

export const meets = (expected: Expected, measured: LinkClass): boolean =>
  expected === "non-combo" ? measured === "read" || measured === "none" : measured === expected;

export interface CaseResult {
  readonly kase: ComboCase;
  readonly row: LinkRow | undefined;
  readonly passed: boolean;
}

export function judge(kase: ComboCase, rows: readonly LinkRow[]): CaseResult {
  const row = rows.find((own) => own.followUp === kase.followUp);
  return { kase, row, passed: row !== undefined && meets(kase.expected, row.class) };
}

export function caseLine(result: CaseResult): string {
  const { kase, row } = result;
  const measured = row === undefined ? `no setup lands the ${kase.region} ${kase.opener}` : `${row.class}${row.diEscapes.length > 0 ? `, DI ${row.diEscapes.join("/")} escapes` : ""}${row.optionEscapes.length > 0 ? `, ${row.optionEscapes.join("/")} escapes` : ""}`;
  return `${result.passed ? "pass" : "MISS"} ${kase.opener} (${kase.region}) at ${kase.percent}% into ${kase.followUp}: expected ${kase.expected}, measured ${measured} (${kase.source})`;
}
