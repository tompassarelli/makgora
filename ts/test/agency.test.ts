import { expect, test } from "bun:test";
import { type AgencyLink, type AgencyRule, type AgencyString, DEFAULT_RULE, type KillConfirm, TICKS_PER_SECOND, conversion, distribution, flagString, linkCause, linkEscape } from "../scripts/agencyCore";
import { DEFAULT_POLICY, measureString, runBranch } from "../scripts/agencyBranch";
import { openFieldMatch } from "../scripts/cpuField";
import { isCpuTier } from "../src/game/match/cpuProfiles";
import { captureReplaySnapshot, createReplaySnapshot } from "../src/game/replay/snapshot";
import { selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { ROSTER, playReal } from "../scripts/playtest";
import { DEFAULT_CONFIG, FINDING_KINDS, type Observation, classify, planMatches } from "../scripts/playtestCore";

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

interface FixtureHit {
  readonly move: string;
  readonly instance: number;
  readonly escape: number;
  readonly gap?: number;
}

const OPTION_IDS = ["neutral", "hold-left", "hold-right", "hold-up", "hold-down", "jump", "shield", "attack", "special", "air-dodge-away"];

/** A string whose link i leaves `escape` of ten live options escaping, hit i + 1 landing `gap` frames after hit i. */
function fixture(hits: readonly FixtureHit[], attacker = "peon", start = 0): AgencyString {
  let frame = 100;
  const links = hits.slice(0, -1).map((hit, link): AgencyLink => {
    const next = hits[link + 1];
    const nextFrame = frame + (hit.gap ?? 30);
    const escaping = Math.round(hit.escape * OPTION_IDS.length);
    const options = OPTION_IDS.map((option, index) => ({ option, escaped: index < escaping }));
    const made: AgencyLink = {
      link, frame, nextFrame, horizon: 60, truncated: false, within: next !== undefined && next.instance === hit.instance && next.move === hit.move,
      computerEscaped: false, options, inert: [], escape: linkEscape(options),
    };
    frame = nextFrame;
    return made;
  });
  let dealt = start;
  return {
    attacker, victim: "thrall", moves: hits.map((hit) => hit.move), instances: hits.map((hit) => hit.instance),
    percents: hits.map(() => (dealt += 5)), links, conversion: conversion(links.map((link) => link.escape)),
  };
}

const chain = (moves: readonly string[], escapes: readonly number[], gap = 30): AgencyString => fixture(moves.map((move, index): FixtureHit => ({ move, instance: index, escape: escapes[index] ?? 0, gap })));
const kinds = (string: AgencyString, rule: AgencyRule = DEFAULT_RULE, confirms: readonly KillConfirm[] = []): string[] => flagString(string, rule, confirms).map((flag) => flag.kind);

test("a string of three follow-ups no option escapes is a true-chain, and two are not [k1 scenario]", () => {
  expect(kinds(chain(["grab", "fair", "fair", "utilt"], [0, 0, 0]))).toContain("true-chain");
  expect(kinds(chain(["grab", "fair", "utilt"], [0, 0]))).toEqual([]);
  const jab = fixture([0, 0, 0, 0, 0].map((_, index): FixtureHit => ({ move: "jab", instance: 1, escape: 0, gap: 5 + index * 0 })));
  expect(kinds(jab)).toEqual([]);
});

test("a six-hit string at 80% escape a link raises no flag [k1 scenario]", () => {
  const six = chain(["a", "b", "c", "d", "e", "f"], [0.8, 0.8, 0.8, 0.8, 0.8]);
  expect(flagString(six)).toEqual([]);
  expect(conversion(six.links.map((link) => link.escape))).toBeCloseTo(0.2 ** 5, 10);
});

test("a later follow-up under the floor is a low-agency-link and the first two are exempt [k1 scenario]", () => {
  const string = chain(["a", "b", "c", "d", "e"], [0.1, 0.1, 0.1, 0.5]);
  expect(flagString(string).filter((flag) => flag.kind === "low-agency-link").map((flag) => flag.links)).toEqual([[2]]);
  expect(kinds(string, { ...DEFAULT_RULE, escapeFloor: 0.1 })).not.toContain("low-agency-link");
  expect(kinds(string, { ...DEFAULT_RULE, escapeFloor: 0.6 })).toContain("low-agency-link");
});

test("consecutive links under the floor past T are long-no-control, and one real escape splits them [k1 scenario]", () => {
  const slow = chain(["a", "b", "c", "d", "e"], [0.1, 0.1, 0.1, 0.1], 50);
  expect(kinds(slow)).toContain("long-no-control");
  expect(kinds(slow, { ...DEFAULT_RULE, controlFrames: 4 * TICKS_PER_SECOND })).not.toContain("long-no-control");
  const split = chain(["a", "b", "c", "d", "e"], [0.1, 0.1, 0.5, 0.1], 50);
  expect(kinds(split)).not.toContain("long-no-control");
});

test("a block of moves repeated without the escape rising is a loop and one where it rises is not [k1 scenario]", () => {
  const moves = ["grab", "dash-attack", "grab", "dash-attack", "grab", "dash-attack", "grab"];
  const flat = chain(moves, [0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
  expect(flagString(flat).find((flag) => flag.kind === "loop")?.detail).toContain("grab > dash-attack repeated 3 times");
  const rising = chain(moves, [0.1, 0.1, 0.3, 0.3, 0.5, 0.5]);
  expect(kinds(rising)).not.toContain("loop");
  expect(kinds(chain(["grab", "fair", "grab", "fair"], [0.1, 0.1, 0.1]))).not.toContain("loop");
});

test("a declared kill confirm inside its percent window is no chain and outside it still is [k1 scenario]", () => {
  const string = chain(["a", "b", "c", "d"], [0, 0, 0]);
  const confirm = (from: number, to: number): KillConfirm => ({ fighter: "peon", opener: "c", followUp: "d", from, to });
  expect(kinds(string, DEFAULT_RULE, [confirm(0, 100)])).not.toContain("true-chain");
  expect(kinds(string, DEFAULT_RULE, [confirm(50, 100)])).toContain("true-chain");
  expect(kinds(string, DEFAULT_RULE, [{ ...confirm(0, 100), fighter: "medivh" }])).toContain("true-chain");
});

test("each flag names the move property the measurement points at [k2 property]", () => {
  const string = chain(["a", "b", "c", "d"], [0, 0, 0]);
  const causes = flagString(string).map((flag) => flag.cause);
  expect(causes.length).toBeGreaterThan(0);
  for (const cause of causes) expect(cause).toMatch(/^(frame data|knockback angle and growth|tech and getup options):/);
  const di = linkCause({ ...string.links[0]!, options: [{ option: "neutral", escaped: false }, { option: "hold-left", escaped: false }] });
  expect(di).toStartWith("knockback angle and growth");
  const tech = linkCause({ ...string.links[0]!, options: [{ option: "neutral", escaped: false }, { option: "tech-away", escaped: false }] });
  expect(tech).toStartWith("tech and getup options");
});

test("a higher floor and a shorter T flag at least as many strings [k2 property]", () => {
  const strings = [chain(["a", "b", "c", "d"], [0.15, 0.15, 0.15]), chain(["a", "b", "c", "d", "e"], [0.3, 0.3, 0.3, 0.3], 40), chain(["a", "b"], [0.5])];
  const cells = distribution(strings, [0.1, 0.2, 0.3, 0.4], [1.5, 2.5]);
  for (const x of cells) for (const y of cells) {
    if (x.escapeFloor <= y.escapeFloor && x.seconds >= y.seconds) expect(x.strings).toBeLessThanOrEqual(y.strings);
  }
  expect(cells.find((cell) => cell.escapeFloor === 0.1 && cell.seconds === 2.5)?.strings).toBe(0);
  expect(cells.find((cell) => cell.escapeFloor === 0.4 && cell.seconds === 1.5)?.strings).toBe(2);
});

test("classify turns a measured string into findings of the new kinds and none of the old [k1 scenario]", () => {
  const observation: Observation = {
    frames: 400, ended: true, winner: null, timedOut: false, stockLosses: 0, strings: [], checksums: [], kos: [], uses: [], combos: [], quiet: { from: 0, frames: 0 },
    agency: [chain(["grab", "fair", "fair", "utilt"], [0, 0, 0])],
  };
  const spec = { index: 0, seed: 7, a: "peon", b: "thrall", stage: "arena", tier: "expert" };
  const findings = classify([{ spec, first: observation, second: undefined, wallMs: 0 }]);
  expect(findings.map((finding) => finding.kind)).toContain("true-chain");
  expect(findings.find((finding) => finding.kind === "true-chain")?.detail).toContain("caused by");
  expect(findings.every((finding) => (FINDING_KINDS as readonly string[]).includes(finding.kind))).toBe(true);
});

test("a branch that ends on its first frame leaves the next branch's capture accepted [k1 scenario]", () => {
  const spec = planMatches(ROSTER, 6, 1)[0];
  if (spec === undefined) throw new Error("no match planned");
  const a = selectableCharacterBySlug(spec.a);
  const b = selectableCharacterBySlug(spec.b);
  if (a === undefined || b === undefined || !isCpuTier(spec.tier)) throw new Error("unplayable spec");
  const opened = openFieldMatch(a, b, spec.stage, 0, { tiers: [spec.tier, spec.tier], frameCap: DEFAULT_CONFIG.frameCap, playtest: true }, spec.seed);
  if (opened === undefined) throw new Error("no spawn");
  const from = createReplaySnapshot();
  captureReplaySnapshot(from, opened.world, opened.match, opened.controls, opened.runtime);
  const scratch = createReplaySnapshot();
  const first = runBranch(opened, from, scratch, 1, 5, () => true, undefined);
  const second = runBranch(opened, from, scratch, 1, 5, () => true, undefined);
  expect(second.end).toBe(first.end);
});
