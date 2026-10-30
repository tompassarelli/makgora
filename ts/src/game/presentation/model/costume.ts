export const MAX_COSTUMES = 8;

export const PARTNER_COSTUME = MAX_COSTUMES;

export type CostumeTint = readonly [red: number, green: number, blue: number];

/** Stock texture swaps, `from` path to `to` path, baked into a costume body built from the fighter's own timeline body (tools/animations/costume-bodies.ts). */
export interface CostumeSkin {
  readonly textures: Readonly<Record<string, string>>;
}

export interface Costume {
  readonly name: string;
  readonly tint?: CostumeTint | undefined;
  readonly skin?: CostumeSkin | undefined;
}

export const DEFAULT_COSTUME: Costume = { name: "Default" };

export const DEFAULT_COSTUMES: readonly Costume[] = [
  DEFAULT_COSTUME,
  { name: "Ember", tint: [255, 175, 130] },
  { name: "Frost", tint: [160, 205, 255] },
  { name: "Verdant", tint: [175, 255, 150] },
];
