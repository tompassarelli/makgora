import { expect, test } from "bun:test";
import type { LinkRow } from "../scripts/comboLinks";
import { linkOptions } from "../scripts/linkTable";

const row = (opener: string, percent: number, extra: Partial<LinkRow> = {}): LinkRow => ({
  fighter: "Test", opener, region: "clean", percent, weight: 75, followUp: "jab", advantage: -10, reach: false, class: "none", diEscapes: [], optionEscapes: [], ...extra,
});

test("the analyzer options read launcher, early kill, launch angle and shield pressure from named rows [k2 property]", () => {
  const table = [
    row("forward smash", 20, { class: "true", advantage: 12, angle: 15, shieldAdvantage: -4, shieldDamage: 9 }),
    row("forward smash", 80, { ko: true, advantage: undefined }),
    row("forward tilt", 0, { shieldAdvantage: -6, shieldDamage: 4 }),
    row("forward tilt", 110, { ko: true, advantage: undefined }),
  ];
  const options = linkOptions(table, "forward smash", "forward tilt");
  expect(options.map((o) => [o.option, o.won, o.row])).toEqual([
    ["d launcher", true, "forward smash clean 20% weight 75 into jab"],
    ["e early kill", true, "forward smash clean 80% weight 75 into jab"],
    ["g launch angle", true, "forward smash clean 20% weight 75 into jab"],
    ["k shield pressure", true, "forward smash clean 20% weight 75 into jab"],
  ]);
});

test("a smash that kills no earlier than its tilt and is less safe on shield wins neither option [k2 property]", () => {
  const table = [
    row("forward smash", 100, { ko: true, advantage: undefined, angle: 45, shieldAdvantage: -20, shieldDamage: 12 }),
    row("forward tilt", 0, { shieldAdvantage: -6, shieldDamage: 4 }),
    row("forward tilt", 110, { ko: true, advantage: undefined }),
  ];
  expect(linkOptions(table, "forward smash", "forward tilt").map((o) => o.won)).toEqual([false, false, false, false]);
});
