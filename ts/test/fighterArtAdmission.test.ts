import { expect, test } from "bun:test";
import { chainSteps, deriveAdmission, importedReads, stepKey } from "../scripts/wisp/fighterArtPlan";

const STEPS = ["clips", "bodies", "flashes"];
const inputs = { steps: STEPS, code: ["c0", "c1", "c2"], fighter: "Kobold", source: "model-a", external: "pins-a", rules: "rules-a" };
type Inputs = typeof inputs;

const derive = (store: Map<string, string>, given: Inputs, outputs: (index: number) => string = (index) => `out-${index}`) => {
  const done: string[] = [];
  for (let index = 0; index < STEPS.length; index++) {
    const key = stepKey(given, index, done);
    store.set(key, outputs(index));
    done.push(outputs(index));
  }
};

const plan = (store: ReadonlyMap<string, string>, changes: Partial<Inputs> = {}) => {
  const chain = chainSteps({ ...inputs, ...changes }, (_, key) => store.get(key), false);
  return { ...chain, steps: STEPS.length };
};

const stored = () => {
  const store = new Map<string, string>();
  derive(store, inputs);
  return store;
};

test("a lane whose fighters' derive inputs are unchanged finds every step stored and asks for no admission [k2 property]", () => {
  const store = stored();
  const plans = ["Kobold", "Lich", "Peon", "Murloc"].map(() => plan(store));
  expect(plans.every(({ cached, steps }) => cached === steps)).toBe(true);
  expect(deriveAdmission(plans)).toBeUndefined();
});

test("changing a fighter's model or rules changes its step keys so the stored steps no longer match and it queues [k2 property]", () => {
  const store = stored();
  for (const changes of [{ source: "model-b" }, { rules: "rules-b" }, { code: ["c0x", "c1", "c2"] }]) {
    const changed = plan(store, changes);
    expect(changed.cached).toBe(0);
    expect(deriveAdmission([changed])).toEqual({ class: "moderate", jobs: 2 });
  }
});

test("a change to the pins every later step hashes redoes the steps after the export and keeps the clip export stored [k2 property]", () => {
  const changed = plan(stored(), { external: "pins-b" });
  expect(changed.cached).toBe(1);
  expect(deriveAdmission([changed])?.class).toBe("moderate");
});

test("a step whose rerun stores the same output as before lets the steps after it reuse their stored outputs (early cutoff) [k2 property]", () => {
  const store = stored(), changed = { ...inputs, code: ["c0", "c1x", "c2"] };
  expect(plan(store, changed).cached).toBe(1);
  derive(store, changed);
  const flashes = stepKey(changed, 2, ["out-0", "out-1"]);
  expect(flashes).toBe(stepKey(inputs, 2, ["out-0", "out-1"]));
  expect(plan(store, changed).cached).toBe(3);
});

test("a step whose rerun changes its output gives the later steps new keys [k2 property]", () => {
  expect(stepKey(inputs, 2, ["out-0", "out-1"])).not.toBe(stepKey(inputs, 2, ["out-0", "out-1b"]));
});

test("only fighters with a missing step count toward the class, so three redone fighters ask for the heavy class [k2 property]", () => {
  const store = stored();
  const redone = (count: number) => [...Array(count).keys()].map(() => plan(store, { source: "model-b" }));
  const unchanged = plan(store);
  expect(deriveAdmission([...redone(2), unchanged, unchanged])).toEqual({ class: "moderate", jobs: 2 });
  expect(deriveAdmission([...redone(3), unchanged])).toEqual({ class: "heavy", jobs: 6 });
});

test("rebuild ignores stored steps and redoes every step [k2 property]", () => {
  expect(chainSteps(inputs, () => "out", true).cached).toBe(0);
});

test("a fighter reads only the imported files its model or rules name, plus its own imported source [k2 property]", () => {
  const files = ["KatranaPrestor.blp", "KatranaPrestorHero.mdx", "LichKing.BLP", "LichKing2.mdx", "SiegeOfTheIronGate-4aa93e339111.mp3"];
  const model = new TextEncoder().encode("MDLX\0Textures\\LICHKING.blp\0");
  expect(importedReads(files, "imported-models/LichKing2.mdx", model, "export const rules = {};")).toEqual(["LichKing.BLP", "LichKing2.mdx"]);
  expect(importedReads(files, "hero-models/peon.mdx", new TextEncoder().encode("MDLX\0peon.blp"), "skin: 'KatranaPrestor.blp'")).toEqual(["KatranaPrestor.blp"]);
});
