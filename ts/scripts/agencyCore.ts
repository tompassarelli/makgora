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

/** One measured link of a string: the hit at `frame` to the hit at `nextFrame`, with the victim options tried at it. */
export interface AgencyLink {
  /** Index of the hit that opens the link; the link runs to hit `link + 1`. */
  readonly link: number;
  readonly frame: number;
  readonly nextFrame: number;
  readonly horizon: number;
  /** The recorded gap to the next hit plus slack exceeded the policy cap, so the escape is measured over a shorter window than the string itself waited. */
  readonly truncated: boolean;
  /** Both hits belong to one move instance (a multi-hit move, or a grab's pummels and throw), so the link is not a follow-up. */
  readonly within: boolean;
  /** Whether the victim computer's own play escaped, which the recorded string says it did not. */
  readonly computerEscaped: boolean;
  readonly options: readonly BranchOutcome[];
  /** Options whose branch ended in the neutral branch's exact state: they changed nothing at this frame. */
  readonly inert: readonly string[];
  readonly escape: number;
}

/** A recorded string with its measured links; `percents[i]` is the victim's percent after hit i. */
export interface AgencyString {
  readonly attacker: string;
  readonly victim: string;
  readonly moves: readonly string[];
  readonly instances: readonly number[];
  readonly percents: readonly number[];
  readonly links: readonly AgencyLink[];
  readonly conversion: number;
}

/** A declared kill confirm: the follow-up may be a true link when the victim's percent after the opener lies in [from, to]. */
export interface KillConfirm {
  readonly fighter: string;
  readonly opener: string;
  readonly followUp: string;
  readonly from: number;
  readonly to: number;
}

/** Every fighter's declared kill confirms; the table starts empty and holds no hidden exception. */
export const KILL_CONFIRMS: readonly KillConfirm[] = [];

export const FLAG_KINDS = ["true-chain", "low-agency-link", "long-no-control", "loop"] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

/** The agency rule's numbers: E and T as chosen on smashcraft#63; chainMax and loopRepeats name the rest of the rule's shape. */
export interface AgencyRule {
  /** A link keeps the victim a real chance when at least this share of weighted options escape it. */
  readonly escapeFloor: number;
  /** Longest stretch, in frames, of consecutive links each under the floor. */
  readonly controlFrames: number;
  /** Most consecutive true (zero-escape) follow-ups before the chain is flagged. */
  readonly chainMax: number;
  /** Consecutive repeats of one block of moves that make a loop when the repeats' escape does not rise. */
  readonly loopRepeats: number;
}

export const TICKS_PER_SECOND = 60;
export const DEFAULT_RULE: AgencyRule = { escapeFloor: 0.1, controlFrames: 3 * TICKS_PER_SECOND, chainMax: 2, loopRepeats: 3 };

export interface AgencyFlag {
  readonly kind: FlagKind;
  /** Indices of the links the flag spans. */
  readonly links: readonly number[];
  readonly frame: number;
  /** The move property the measurement points at: frame data, knockback, or tech and getup options. */
  readonly cause: string;
  readonly detail: string;
}

const percent = (share: number): string => `${(100 * share).toFixed(0)}%`;

/** What keeps the victim in a link, read from which option groups were live there and which of them escaped. */
export function linkCause(link: AgencyLink): string {
  const live = link.options.map((outcome) => outcome.option);
  const has = (test: (id: string) => boolean): boolean => live.some(test);
  const tech = has((id) => id.startsWith("tech-") || id.startsWith("getup-"));
  const air = has((id) => id === "jump" || id.startsWith("air-dodge-") || id === "shield" || id === "attack" || id === "special");
  const gap = link.nextFrame - link.frame;
  if (tech && !air) return `tech and getup options: the victim is down and only tech/getup choices were live, none escaping within ${gap} frames`;
  if (!air && !tech) return `knockback angle and growth: only directional influence was live, and no direction escaped within ${gap} frames`;
  return `frame data: the next hit lands ${gap} frames after this one and ${live.length} live options escape ${percent(link.escape)} of the time`;
}

const confirmed = (string: AgencyString, link: AgencyLink, confirms: readonly KillConfirm[]): boolean => {
  const at = string.percents[link.link] ?? 0;
  const opener = string.moves[link.link];
  const followUp = string.moves[link.link + 1];
  return confirms.some((confirm) => confirm.fighter === string.attacker && confirm.opener === opener && confirm.followUp === followUp && at >= confirm.from && at <= confirm.to);
};

const arrow = (string: AgencyString, link: AgencyLink): string => `${string.moves[link.link] ?? "?"} into ${string.moves[link.link + 1] ?? "?"}`;

function loopFlag(string: AgencyString, between: readonly AgencyLink[], rule: AgencyRule): AgencyFlag | undefined {
  const names: string[] = [];
  const escapes: number[] = [];
  const opened: AgencyLink[] = [];
  for (const [hit, move] of string.moves.entries()) {
    if (hit > 0 && string.instances[hit] === string.instances[hit - 1] && move === string.moves[hit - 1]) continue;
    names.push(move);
  }
  for (const link of between) {
    escapes.push(link.escape);
    opened.push(link);
  }
  for (let period = 1; period * rule.loopRepeats <= names.length; period++) {
    for (let start = 0; start + period * rule.loopRepeats <= names.length; start++) {
      let repeats = 1;
      while (start + (repeats + 1) * period <= names.length && names.slice(start, start + period).every((name, i) => names[start + repeats * period + i] === name)) repeats++;
      if (repeats < rule.loopRepeats) continue;
      const cycle = (c: number): number => escapes.slice(start + c * period, start + (c + 1) * period).reduce((sum, escape) => sum + escape, 0);
      let rises = false;
      for (let c = 1; c < repeats; c++) if (cycle(c) > cycle(c - 1) + 1e-9) rises = true;
      if (rises) continue;
      const first = opened[start];
      const lastTransition = opened[start + repeats * period - 1] ?? opened.at(-1);
      if (first === undefined || lastTransition === undefined) continue;
      const block = names.slice(start, start + period).join(" > ");
      return {
        kind: "loop",
        links: opened.slice(start, start + repeats * period).map((link) => link.link),
        frame: first.frame,
        cause: linkCause(first),
        detail: `${block} repeated ${repeats} times with no rise in the victim's escape (${percent(cycle(0))} the first cycle, ${percent(cycle(repeats - 1))} the last)`,
      };
    }
  }
  return undefined;
}

/** The finding kinds a measured string earns under a rule: true-chain, low-agency-link, long-no-control, loop. */
export function flagString(string: AgencyString, rule: AgencyRule = DEFAULT_RULE, confirms: readonly KillConfirm[] = KILL_CONFIRMS): AgencyFlag[] {
  const flags: AgencyFlag[] = [];
  const between = string.links.filter((link) => !link.within);
  const tagged = new Set(between.filter((link) => confirmed(string, link, confirms)).map((link) => link.link));
  const chained = new Set<number>();
  let run: AgencyLink[] = [];
  const closeRun = (): void => {
    if (run.length > rule.chainMax) {
      for (const link of run) chained.add(link.link);
      const first = run[0];
      if (first !== undefined) flags.push({ kind: "true-chain", links: run.map((link) => link.link), frame: first.frame, cause: linkCause(first), detail: `${run.length} follow-ups in a row (${run.map((link) => arrow(string, link)).join(", ")}) with no victim option escaping any of them, over the ${rule.chainMax} allowed` });
    }
    run = [];
  };
  for (const link of between) {
    if (tagged.has(link.link)) closeRun();
    else if (link.escape === 0) run.push(link);
    else closeRun();
  }
  closeRun();
  for (const [index, link] of between.entries()) {
    if (index < rule.chainMax || tagged.has(link.link) || chained.has(link.link) || link.escape >= rule.escapeFloor) continue;
    flags.push({ kind: "low-agency-link", links: [link.link], frame: link.frame, cause: linkCause(link), detail: `follow-up ${index + 1} (${arrow(string, link)}) leaves the victim ${percent(link.escape)} escape, under the ${percent(rule.escapeFloor)} floor` });
  }
  let span: AgencyLink[] = [];
  const closeSpan = (): void => {
    const first = span[0];
    const last = span.at(-1);
    if (first !== undefined && last !== undefined && last.nextFrame - first.frame > rule.controlFrames) {
      const frames = last.nextFrame - first.frame;
      const worst = span.reduce((pick, link) => (link.nextFrame - link.frame > pick.nextFrame - pick.frame ? link : pick), first);
      flags.push({ kind: "long-no-control", links: span.map((link) => link.link), frame: first.frame, cause: linkCause(worst), detail: `${(frames / TICKS_PER_SECOND).toFixed(1)} s from frame ${first.frame} with every link under the ${percent(rule.escapeFloor)} floor, over ${(rule.controlFrames / TICKS_PER_SECOND).toFixed(1)} s` });
    }
    span = [];
  };
  for (const link of string.links) {
    if (tagged.has(link.link) || link.escape >= rule.escapeFloor) closeSpan();
    else span.push(link);
  }
  closeSpan();
  const loop = loopFlag(string, between, rule);
  if (loop !== undefined) flags.push(loop);
  return flags;
}

export interface DistributionCell {
  readonly escapeFloor: number;
  readonly seconds: number;
  readonly strings: number;
  readonly byKind: Readonly<Record<FlagKind, number>>;
}

/** How many of `strings` each candidate (E, T) pair flags, in total and by kind. */
export function distribution(strings: readonly AgencyString[], floors: readonly number[], seconds: readonly number[], base: AgencyRule = DEFAULT_RULE, confirms: readonly KillConfirm[] = KILL_CONFIRMS): DistributionCell[] {
  return floors.flatMap((escapeFloor) => seconds.map((second): DistributionCell => {
    const rule: AgencyRule = { ...base, escapeFloor, controlFrames: second * TICKS_PER_SECOND };
    const byKind: Record<FlagKind, number> = { "true-chain": 0, "low-agency-link": 0, "long-no-control": 0, loop: 0 };
    let flagged = 0;
    for (const string of strings) {
      const kinds = new Set(flagString(string, rule, confirms).map((flag) => flag.kind));
      if (kinds.size > 0) flagged++;
      for (const kind of kinds) byKind[kind]++;
    }
    return { escapeFloor, seconds: second, strings: flagged, byKind };
  }));
}
