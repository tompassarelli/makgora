import { expect, test } from "bun:test";
import { conversion, linkEscape } from "../scripts/agencyCore";
import { DEFAULT_POLICY, measureString } from "../scripts/agencyBranch";
import { ROSTER, playReal } from "../scripts/playtest";
import { DEFAULT_CONFIG, planMatches } from "../scripts/playtestCore";

test("a link with no escaping branch reports 0 whatever the weights [k2 property]", () => {
  const outcomes = ["neutral", "hold-left", "shield"].map((option) => ({ option, escaped: false }));
  expect(linkEscape(outcomes)).toBe(0);
  expect(linkEscape(outcomes, { shield: 50 })).toBe(0);
  expect(linkEscape([])).toBe(0);
});

test("the escape is the weighted share of escaping options [k2 property]", () => {
  const outcomes = [{ option: "a", escaped: true }, { option: "b", escaped: false }, { option: "c", escaped: false }, { option: "d", escaped: false }];
  expect(linkEscape(outcomes)).toBe(0.25);
  expect(linkEscape(outcomes, { a: 3 })).toBe(0.5);
  expect(conversion([0.5, 0.5, 0])).toBe(0.25);
});

test("branching from a recorded string reproduces its own next hit when the victim computer plays [k1 scenario]", () => {
  const spec = planMatches(ROSTER, 6, 1)[0];
  if (spec === undefined) throw new Error("no match planned");
  const observed = playReal(spec, DEFAULT_CONFIG.frameCap);
  const measured = observed.combos
    .filter((combo) => combo.hitFrames.length >= 2 && combo.hitFrames.every((frame, hit) => hit === 0 || frame - (combo.hitFrames[hit - 1] ?? 0) + DEFAULT_POLICY.slack <= DEFAULT_POLICY.maxHorizon))
    .slice(0, 2)
    .flatMap((combo) => measureString(spec, combo, DEFAULT_CONFIG.frameCap).links);
  expect(measured.length).toBeGreaterThan(0);
  for (const link of measured) {
    expect(link.truncated).toBe(false);
    expect(link.computerEscaped).toBe(false);
    expect(link.options.length).toBeGreaterThan(0);
  }
}, 120000);
