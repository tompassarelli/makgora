export type Value = number | string;

export type Family = "hits" | "defence" | "movement" | "attributes";

export const FAMILY_TITLES: Readonly<Record<Family, string>> = {
  hits: "Hits, knockback and hitstun",
  defence: "Defence: techs, knockdown, getups, shield, grabs and throws",
  movement: "Movement, landing, ledges, platforms and the stick",
  attributes: "Fighter attributes",
};

export type Melee =
  | { readonly value: Value; readonly source: string }
  | { readonly undocumented: string; readonly source: string }
  | { readonly spread: readonly [number, number]; readonly note: string; readonly source: string };

export type Status =
  | { readonly kind: "parity" }
  | { readonly kind: "deviation"; readonly reason: string; readonly decided: string; readonly issue?: number }
  | { readonly kind: "open"; readonly reason: string; readonly issue?: number };

export interface Anchor {
  readonly file: string;
  readonly symbol: string;
}

export interface LedgerRow {
  readonly id: string;
  readonly family: Family;
  readonly block?: string;
  readonly name: string;
  readonly melee: Melee;
  readonly ours: () => Value;
  readonly anchor: Anchor;
  readonly checkedBy?: Anchor;
  readonly status: Status;
}

export const PARITY: Status = { kind: "parity" };

export function sameValue(ours: Value, melee: Value): boolean {
  if (typeof ours === "number" && typeof melee === "number") return Math.fround(ours) === Math.fround(melee);
  return ours === melee;
}

export function shortNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const single = Math.fround(value);
  for (let digits = 1; digits <= 17; digits++) {
    const text = String(Number(value.toPrecision(digits)));
    if (Math.fround(Number(text)) === single) return text;
  }
  return String(value);
}

export const showValue = (value: Value): string => (typeof value === "number" ? shortNumber(value) : value);

export interface Formula<Input> {
  readonly text: string;
  readonly inputs: readonly Input[];
  readonly label: (input: Input) => string;
  readonly ours: (input: Input) => number;
  readonly melee: (input: Input) => number;
  readonly close?: (ours: number, melee: number) => boolean;
}

export function probe<Input>(formula: Formula<Input>): () => Value {
  return () => {
    const close = formula.close ?? ((ours: number, melee: number) => sameValue(ours, melee));
    for (const input of formula.inputs) {
      const ours = formula.ours(input);
      const melee = formula.melee(input);
      if (!close(ours, melee)) return `differs at ${formula.label(input)}: ${shortNumber(ours)}, Melee ${shortNumber(melee)}`;
    }
    return formula.text;
  };
}

export const range = (from: number, to: number, step = 1): number[] => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, index) => from + index * step);

export type ReadSource = (file: string) => string | undefined;

export interface FamilyNote {
  readonly family: Family;
  readonly lines: readonly string[];
  readonly problems: readonly string[];
}
