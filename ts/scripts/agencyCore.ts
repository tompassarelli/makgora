/** One victim option tried at one link: the option escaped when the attacker's next hit did not land inside the link's horizon. */
export interface BranchOutcome {
  readonly option: string;
  readonly escaped: boolean;
}

/** Relative weight per option id; an option with no entry weighs 1 (uniform). */
export type OptionWeights = Readonly<Record<string, number>>;

/** The weighted share of victim options that escape the link; a link with no escaping branch, or no branch, is 0. */
export function linkEscape(outcomes: readonly BranchOutcome[], weights: OptionWeights = {}): number {
  let total = 0;
  let escaping = 0;
  for (const outcome of outcomes) {
    const weight = weights[outcome.option] ?? 1;
    if (!(weight >= 0) || !Number.isFinite(weight)) throw new Error(`option ${outcome.option} has weight ${weight}`);
    total += weight;
    if (outcome.escaped) escaping += weight;
  }
  return total === 0 ? 0 : escaping / total;
}

/** The chance a string's links all hold: the product of each link's no-escape share. */
export function conversion(escapes: readonly number[]): number {
  return escapes.reduce((product, escape) => product * (1 - escape), 1);
}
