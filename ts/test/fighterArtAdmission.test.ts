import { expect, test } from "bun:test";
import { chainSteps, deriveAdmission, stepKey } from "../scripts/wisp/fighterArtPlan";

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

test("changing a fighter's model or rules changes its step keys so the stored steps no longer match and it queues [k2 property]", () => {
  const store = stored();
  for (const changes of [{ source: "model-b" }, { rules: "rules-b" }, { code: ["c0x", "c1", "c2"] }]) {
    const changed = plan(store, changes);
    expect(changed.cached).toBe(0);
    expect(deriveAdmission([changed])).toEqual({ class: "moderate", jobs: 2 });
  }
});
