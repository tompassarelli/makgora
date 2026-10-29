export const SPECIAL_SLOTS = ["neutral", "side", "up", "down"] as const;
export type SpecialSlot = (typeof SPECIAL_SLOTS)[number];

export const slotCues = <Cues>(hero: { readonly [slot in SpecialSlot]?: Cues }): readonly Cues[] => SPECIAL_SLOTS.flatMap((slot) => hero[slot] ?? []);
