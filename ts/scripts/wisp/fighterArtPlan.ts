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

export const stepKeys = ({ steps, code, fighter, source, external, rules }: StepKeyInputs): string[] => {
  const keys: string[] = [];
  steps.forEach((step, index) => keys.push(sha256(step, code[index]!, fighter, index === 0 ? source : keys[index - 1]!, index === 0 ? "" : external, rules)));
  return keys;
};

export const cachedSteps = (keys: readonly string[], stored: (index: number, key: string) => boolean, rebuild: boolean): number => {
  if (rebuild) return 0;
  const missing = keys.findIndex((key, index) => !stored(index, key));
  return missing < 0 ? keys.length : missing;
};

export interface DeriveAdmission { readonly class: "moderate" | "heavy"; readonly jobs: number }

export const deriveAdmission = (plans: readonly { readonly keys: readonly string[]; readonly cached: number }[]): DeriveAdmission | undefined => {
  const building = plans.filter((plan) => plan.cached < plan.keys.length).length;
  if (building === 0) return undefined;
  return building <= 2 ? { class: "moderate", jobs: 2 } : { class: "heavy", jobs: 6 };
};
