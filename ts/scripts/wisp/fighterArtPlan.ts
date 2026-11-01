export const sha256 = (...parts: readonly (string | Uint8Array)[]) => {
  const hasher = new Bun.CryptoHasher("sha256");
  for (const part of parts) hasher.update(part).update("\0");
  return hasher.digest("hex");
};

export interface StepKeyInputs {
  readonly steps: readonly string[];
  readonly code: readonly string[];
  readonly fighter: string;
  readonly source: string;
  readonly external: string;
  readonly rules: string | Uint8Array;
}

export const stepKey = ({ steps, code, fighter, source, external, rules }: StepKeyInputs, index: number, earlierOutputs: readonly string[]): string =>
  sha256(steps[index]!, code[index]!, fighter, source, index === 0 ? "" : external, rules, ...earlierOutputs.slice(0, index));

export interface StepChain { readonly keys: readonly string[]; readonly outputs: readonly string[]; readonly cached: number }

export const chainSteps = (inputs: StepKeyInputs, storedOutput: (index: number, key: string) => string | undefined, rebuild: boolean): StepChain => {
  const keys: string[] = [], outputs: string[] = [];
  for (let index = 0; index < inputs.steps.length; index++) {
    const key = stepKey(inputs, index, outputs);
    keys.push(key);
    const output = rebuild ? undefined : storedOutput(index, key);
    if (output === undefined) break;
    outputs.push(output);
  }
  return { keys, outputs, cached: outputs.length };
};

export const IMPORTED_FAMILY = "imported-models";

export const importedReads = (files: readonly string[], source: string, sourceBytes: Uint8Array, rules: string | Uint8Array): string[] => {
  const text = (Buffer.from(sourceBytes).toString("latin1") + "\0" + (typeof rules === "string" ? rules : Buffer.from(rules).toString("utf8"))).toLowerCase();
  const own = source.startsWith(`${IMPORTED_FAMILY}/`) ? source.slice(IMPORTED_FAMILY.length + 1) : undefined;
  return files.filter((file) => file === own || text.includes(file.toLowerCase())).sort();
};

export interface DeriveAdmission { readonly class: "moderate" | "heavy"; readonly jobs: number }

export const deriveAdmission = (plans: readonly { readonly steps: number; readonly cached: number }[]): DeriveAdmission | undefined => {
  const building = plans.filter((plan) => plan.cached < plan.steps).length;
  if (building === 0) return undefined;
  return building <= 2 ? { class: "moderate", jobs: 2 } : { class: "heavy", jobs: 6 };
};
