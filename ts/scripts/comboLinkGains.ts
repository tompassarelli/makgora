import { LINK_PERCENTS, type LinkClass, type LinkRow } from "./comboLinks";

export const ATTRIBUTION_PERCENTS: readonly number[] = LINK_PERCENTS.filter((percent) => percent <= 60);
const ATTRIBUTION_BANDS: readonly { readonly name: string; readonly from: number; readonly to: number }[] = [{ name: "0-20%", from: 0, to: 29 }, { name: "30-60%", from: 30, to: 60 }];
const GAINED_CLASSES: readonly LinkClass[] = ["true", "DI-dependent"];

export interface LinkGain {
  readonly band: string;
  readonly class: LinkClass;
  readonly before: number;
  readonly after: number;
  readonly gained: number;
  readonly lost: number;
}

const linkKey = (row: LinkRow): string => `${row.opener}|${row.region}|${row.percent}|${row.weight}|${row.followUp}`;

export function linkGains(before: readonly LinkRow[], after: readonly LinkRow[]): LinkGain[] {
  return ATTRIBUTION_BANDS.flatMap((band) => GAINED_CLASSES.map((kind) => {
    const holding = (rows: readonly LinkRow[]) => new Set(rows.filter((row) => row.class === kind && row.percent >= band.from && row.percent <= band.to).map(linkKey));
    const from = holding(before);
    const to = holding(after);
    return {
      band: band.name, class: kind, before: from.size, after: to.size,
      gained: [...to].filter((key) => !from.has(key)).length, lost: [...from].filter((key) => !to.has(key)).length,
    };
  }));
}
