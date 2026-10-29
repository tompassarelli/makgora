import { expect, test } from "bun:test";
import { cachedSteps, deriveAdmission, stepKeys } from "../scripts/wisp/fighterArtPlan";

const STEPS = ["clips", "bodies", "flashes"];
const inputs = { steps: STEPS, code: ["c0", "c1", "c2"], fighter: "Kobold", source: "model-a", external: "pins-a", rules: "rules-a" };

const plan = (stored: ReadonlySet<string>, changes: Partial<typeof inputs> = {}) => {
  const keys = stepKeys({ ...inputs, ...changes });
  return { keys, cached: cachedSteps(keys, (_, key) => stored.has(key), false) };
};

test("a lane whose fighters' derive inputs are unchanged finds every step stored and asks for no admission [k2 property]", () => {
  const stored = new Set(stepKeys(inputs));
  const plans = ["Kobold", "Lich", "Peon", "Murloc"].map(() => plan(stored));
  expect(plans.every(({ keys, cached }) => cached === keys.length)).toBe(true);
  expect(deriveAdmission(plans)).toBeUndefined();
});

test("changing a fighter's model or rules changes its step keys so the stored steps no longer match and it queues [k2 property]", () => {
  const stored = new Set(stepKeys(inputs));
  for (const changes of [{ source: "model-b" }, { rules: "rules-b" }, { code: ["c0x", "c1", "c2"] }]) {
    const changed = plan(stored, changes);
    expect(changed.cached).toBeLessThan(changed.keys.length);
    expect(deriveAdmission([changed])).toEqual({ class: "moderate", jobs: 2 });
  }
});

test("a change to the pins every later step hashes redoes the steps after the export and keeps the clip export stored [k2 property]", () => {
  const stored = new Set(stepKeys(inputs));
  const changed = plan(stored, { external: "pins-b" });
  expect(changed.cached).toBe(1);
  expect(deriveAdmission([changed])?.class).toBe("moderate");
});

test("only fighters with a missing step count toward the class, so three redone fighters ask for the heavy class [k2 property]", () => {
  const stored = new Set(stepKeys(inputs));
  const redone = (count: number) => [...Array(count).keys()].map(() => plan(stored, { source: "model-b" }));
  const unchanged = plan(stored);
  expect(deriveAdmission([...redone(2), unchanged, unchanged])).toEqual({ class: "moderate", jobs: 2 });
  expect(deriveAdmission([...redone(3), unchanged])).toEqual({ class: "heavy", jobs: 6 });
});

test("rebuild ignores stored steps and redoes every step [k2 property]", () => {
  const keys = stepKeys(inputs);
  expect(cachedSteps(keys, () => true, true)).toBe(0);
});
