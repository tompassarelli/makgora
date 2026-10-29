export const MAX_COSTUMES = 8;

export type CostumeTint = readonly [red: number, green: number, blue: number];

export interface Costume {
  readonly name: string;
  readonly tint?: CostumeTint | undefined;
}

export const DEFAULT_COSTUME: Costume = { name: "Default" };

export const DEFAULT_COSTUMES: readonly Costume[] = [
  DEFAULT_COSTUME,
  { name: "Ember", tint: [255, 175, 130] },
  { name: "Frost", tint: [160, 205, 255] },
  { name: "Verdant", tint: [175, 255, 150] },
];
