import type { model as mdx } from "war3-model";

export interface Variant {
  readonly name: string;
  readonly angles: Readonly<Record<string, number>>;
  readonly bones?: Readonly<Record<string, number>>;
  readonly fold: number;
  readonly lean: number;
  readonly squash?: number;
  readonly parentFrame: boolean;
}
export type Choice = Readonly<Record<string, number>>;
export interface Measure { readonly assets: string; readonly character: number; readonly model: mdx.Model; readonly index: number; readonly frames: number }
export interface Space {
  readonly starts: readonly Choice[];
  readonly options: Readonly<Record<string, readonly number[]>>;
  readonly variant: (choice: Choice) => Variant;
  readonly randomStarts?: number;
  readonly local?: boolean;
  readonly extra?: (measure: Measure) => { readonly value: number; readonly report: string };
}
