import { expect, test } from "bun:test";
import { effectRecordProblem, formatEffectRecord } from "../scripts/wisp/cueModels";
import type { EffectUse, ModelFacts } from "../scripts/wisp/effectVisibility";

const use = (model: string): EffectUse => ({ fighter: "fixture", move: `cue ${model}`, kind: "special cue", model, sequence: "stand", seconds: 0, timeScale: 1, travels: false, anchored: "fighter" });
const drawsNothing: ModelFacts = { sequences: [{ name: "Stand", start: 0, end: 1000, looping: true, rarity: 0 }], particles: 0, legacyParticles: false, emitters: [], ribbons: [], geosets: [] };
const record = (facts: ReadonlyMap<string, ModelFacts | null>) => formatEffectRecord({ cacheInfo: "0".repeat(64), models: new Map([...facts.keys()].map((model) => [model, "fixture"])), facts });

test("the cue gate refuses a use whose model the record lacks and a use whose recorded facts draw nothing, and passes the same record without them [k2 property]", () => {
  const text = record(new Map<string, ModelFacts | null>([["Fixture\\Blank.mdx", drawsNothing], ["Fixture\\Uncached.mdx", null]]));
  expect(effectRecordProblem(text, [use("Fixture\\Uncached.mdx")])).toBeUndefined();
  expect(effectRecordProblem(text, [use("Fixture\\Uncached.mdx"), use("Fixture\\Absent.mdx")])).toContain("no model facts for 1 newly used models");
  expect(effectRecordProblem(text, [use("Fixture\\Uncached.mdx"), use("Fixture\\Blank.mdx")])).toContain("1 invisible uses refuse the gate: fixture/cue Fixture\\Blank.mdx");
});
